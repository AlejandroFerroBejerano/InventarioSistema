using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Scan;
using Inventario.Api.Services.Scan;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScansController : ControllerBase
{
    private static readonly List<int> DefaultPorts = new() { 80, 443, 554, 8000, 8080, 37777, 8899 };

    private readonly DiscoveryService _discovery;
    private readonly CredentialProvider _credentialProvider;
    private readonly IEnumerable<IProtocolScanner> _protocolScanners;
    private readonly InventarioDbContext _db;

    public ScansController(
        DiscoveryService discovery,
        CredentialProvider credentialProvider,
        IEnumerable<IProtocolScanner> protocolScanners,
        InventarioDbContext db)
    {
        _discovery = discovery;
        _credentialProvider = credentialProvider;
        _protocolScanners = protocolScanners;
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<ScanResponseDto>> Start([FromBody] StartScanRequest request, CancellationToken ct)
    {
        var ips = CidrHelper.Expand(request.NetworkCidr);

        var ports = (request.Ports is { Count: > 0 } ? request.Ports : DefaultPorts)
            .Distinct()
            .Where(p => p is > 0 and < 65536)
            .ToList();

        var response = new ScanResponseDto
        {
            AbonadoMm = request.AbonadoMm.Trim(),
            NetworkCidr = request.NetworkCidr.Trim(),
            StartedAt = DateTime.UtcNow
        };

        var applyMode = NormalizeApplyMode(request.ApplyMode);

        // 1) DISCOVERY (TCP + SSDP)
        var hosts = await _discovery.DiscoverAsync(
            ips: ips,
            ports: ports,
            connectTimeoutMs: request.ConnectTimeoutMs,
            maxConcurrency: request.MaxConcurrency,
            useSsdp: request.UseSsdp,
            ssdpListenMs: request.SsdpListenMs,
            ct: ct);

        // 2) Protocolos seleccionados (si el usuario los envía)
        var selectedNames = request.Protocols?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // ✅ Si viene lista vacía, lo interpretamos como "sin filtro" (= todos)
        if (selectedNames is { Count: 0 })
            selectedNames = null;

        var scannersToUse = _protocolScanners
            .Where(p => selectedNames is null || selectedNames.Contains(p.Name))
            .ToList();
        
        // 🔎 Log opcional para depuración
        Console.WriteLine($"Scanners activos: {string.Join(", ", scannersToUse.Select(s => s.Name))}");

        // 2.1) Obtener InstallationId una vez (evita navegar Installation en SystemAsset)
        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == response.AbonadoMm)
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        // 3) Intentar protocolos por host
        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            // Garantizar OpenPorts no-null
            host.OpenPorts ??= new List<int>();
            var openPorts = host.OpenPorts;

            // Buscar asset existente para obtener credencial preferida (si existe)
            SystemAsset? existingAsset = null;
            if (installationId.HasValue)
            {
                existingAsset = await _db.SystemAssets
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a =>
                        a.InstallationId == installationId.Value &&
                        a.IpAddress == host.Ip,
                        ct);
            }

            var preferredCredentialId = existingAsset?.PreferredCredentialId;

            // Obtener credenciales (preferida primero si existe)
            var creds = await _credentialProvider.GetActiveCredentialsAsync(
                response.AbonadoMm,
                preferredCredentialId,
                ct);
            
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("--------------------------------------------------");
            Console.WriteLine($"HOST: {host.Ip}");
            Console.WriteLine($"Credenciales activas recibidas: {creds.Count}");
            Console.WriteLine($"PreferredCredentialId: {preferredCredentialId}");
            Console.WriteLine("--------------------------------------------------");
            Console.ResetColor();

            // Elegir WebPort por conveniencia (443 preferido)
            host.WebPort = openPorts.Contains(443) ? 443 :
                           openPorts.Contains(80) ? 80 : null;

            if (openPorts.Count == 0)
                continue;

            foreach (var scanner in scannersToUse)
            {
                if (!scanner.CanTry(host))
                    continue;

                var auth = await scanner.TryAsync(host, creds, ct);
                if (auth is null || !auth.Success)
                    continue;

                // Rellenar host con info encontrada
                host.Protocol = auth.Protocol;
                host.Manufacturer = auth.Manufacturer;
                host.Model = auth.Model;
                host.Firmware = auth.Firmware;
                host.SerialNumber = auth.SerialNumber;

                host.WebPort = auth.WebPort ?? host.WebPort;
                host.SdkPort = auth.SdkPort;

                host.CredentialId = auth.CredentialId;
                host.CredentialUsername = auth.CredentialUsername;

                host.Status = auth.CredentialId.HasValue ? "Authenticated" : "Identified";

                break; // si uno funciona, paramos
            }
        }

        response.Hosts = hosts;
        response.FinishedAt = DateTime.UtcNow;

        // -----------------------------
        // Persistencia: SystemAssets (UPSERT) según ApplyMode
        // -----------------------------
        var installation = await _db.Installations
            .FirstOrDefaultAsync(x => x.AbonadoMm == response.AbonadoMm, ct);

        if (installation is not null)
        {
            var now = DateTime.UtcNow;

            foreach (var host in hosts)
            {
                ct.ThrowIfCancellationRequested();

                if (string.Equals(host.Status, "NoPorts", StringComparison.OrdinalIgnoreCase)) continue;

                var asset = await _db.SystemAssets
                    .FirstOrDefaultAsync(x =>
                        x.InstallationId == installation.Id &&
                        x.IpAddress == host.Ip, ct);

                if (asset is null)
                {
                    asset = new SystemAsset
                    {
                        InstallationId = installation.Id,
                        IpAddress = host.Ip,
                        CreatedAt = now
                    };
                    _db.SystemAssets.Add(asset);
                }

                // Siempre
                asset.LastSeenAt = now;
                asset.OpenPortsJson = JsonSerializer.Serialize(host.OpenPorts ?? new List<int>());
                asset.WebPort = host.WebPort ?? asset.WebPort;
                asset.SdkPort = host.SdkPort ?? asset.SdkPort;

                // Aplicación según modo
                if (applyMode.Equals("LastWins", StringComparison.OrdinalIgnoreCase))
                {
                    asset.Category = string.IsNullOrWhiteSpace(host.Category) ? asset.Category : host.Category!;
                    asset.Manufacturer = host.Manufacturer;
                    asset.Model = host.Model;
                    asset.Firmware = host.Firmware;
                    asset.SerialNumber = host.SerialNumber;
                    asset.Protocol = host.Protocol;
                    asset.Status = host.Status;
                }
                else
                {
                    // NoDegrade (y Review por ahora lo tratamos igual)
                    asset.Category = KeepIfUnknown(asset.Category, host.Category) ?? asset.Category ?? "Unknown";
                    asset.Manufacturer = KeepIfBlank(asset.Manufacturer, host.Manufacturer);
                    asset.Model = KeepIfBlank(asset.Model, host.Model);
                    asset.Firmware = KeepIfBlank(asset.Firmware, host.Firmware);
                    asset.SerialNumber = KeepIfBlank(asset.SerialNumber, host.SerialNumber);
                    asset.Protocol = KeepIfBlank(asset.Protocol, host.Protocol);
                    asset.Status = KeepBestStatus(asset.Status, host.Status);
                }

                // Guardar credencial preferida si autenticó
                if (string.Equals(host.Status, "Authenticated", StringComparison.OrdinalIgnoreCase)
                    && host.CredentialId.HasValue)
                {
                    asset.PreferredCredentialId = host.CredentialId.Value;
                }
            }

            var dbFile = _db.Database.GetDbConnection().DataSource;

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"[SCAN] DB Path = {dbFile}");
            Console.WriteLine($"[SCAN] AbonadoMm = '{response.AbonadoMm}'");
            Console.ResetColor();

            await _db.SaveChangesAsync(ct);
            
            var totalAssets = await _db.SystemAssets.CountAsync(ct);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"[SCAN] SaveChanges OK. Total SystemAssets now = {totalAssets}");
            Console.ResetColor();
        }

        return Ok(response);
    }

    // -----------------------------
    // Helpers (A3) - a nivel de clase
    // -----------------------------
    private static string NormalizeApplyMode(string? mode)
    {
        var m = (mode ?? "").Trim();
        if (m.Equals("LastWins", StringComparison.OrdinalIgnoreCase)) return "LastWins";
        if (m.Equals("NoDegrade", StringComparison.OrdinalIgnoreCase)) return "NoDegrade";
        if (m.Equals("Review", StringComparison.OrdinalIgnoreCase)) return "Review";
        return "NoDegrade";
    }

    private static int StatusRank(string? s) => (s ?? "").Trim().ToLowerInvariant() switch
    {
        "authenticated" => 3,
        "identified" => 2,
        "noports" => 1,
        _ => 0
    };

    private static string? KeepIfBlank(string? current, string? incoming)
        => string.IsNullOrWhiteSpace(incoming) ? current : incoming;

    private static string? KeepIfUnknown(string? current, string? incoming)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return current;
        if (string.Equals(incoming, "Unknown", StringComparison.OrdinalIgnoreCase)) return current;
        return incoming;
    }

    private static string? KeepBestStatus(string? current, string? incoming)
        => StatusRank(incoming) >= StatusRank(current) ? incoming : current;
}
