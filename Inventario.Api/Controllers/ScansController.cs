using Inventario.Api.Models.Scan;
using Inventario.Api.Services.Scan;
using Microsoft.AspNetCore.Mvc;
using Inventario.Api.Data;
using Inventario.Api.Entities;
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

        // 1) DISCOVERY (TCP + SSDP)
        var hosts = await _discovery.DiscoverAsync(
            ips: ips,
            ports: ports,
            connectTimeoutMs: request.ConnectTimeoutMs,
            maxConcurrency: request.MaxConcurrency,
            useSsdp: request.UseSsdp,
            ssdpListenMs: request.SsdpListenMs,
            ct: ct);

        // 2) Preparar lista de protocolos seleccionados (si el usuario los envía)
        var selectedNames = request.Protocols?
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var scannersToUse = _protocolScanners
            .Where(p => selectedNames is null || selectedNames.Contains(p.Name))
            .ToList();

        // 2.1) Obtener InstallationId una vez (para evitar navegar Installation en SystemAsset y quitar CS8602)
        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == response.AbonadoMm)
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        // 3) Intentar protocolos por host
        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            // Garantizar OpenPorts no-null (evita CS8602)
            var openPorts = host.OpenPorts ?? new List<int>();
            host.OpenPorts = openPorts;

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

                host.Status = auth.Protocol.Equals("OnvifDiscovery", StringComparison.OrdinalIgnoreCase)
                    ? "Identified"
                    : "Authenticated";

                // Category (MVP): si no viene informada aún, dejamos Unknown
                host.Category ??= "Unknown";

                break; // si uno funciona, paramos
            }
        }

        response.Hosts = hosts;
        response.FinishedAt = DateTime.UtcNow;

        // -----------------------------
        // Persistencia: SystemAssets (UPSERT)
        // -----------------------------
        var installation = await _db.Installations
            .FirstOrDefaultAsync(x => x.AbonadoMm == response.AbonadoMm, ct);

        if (installation is not null)
        {
            var now = DateTime.UtcNow;

            foreach (var host in hosts)
            {
                ct.ThrowIfCancellationRequested();

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

                asset.LastSeenAt = now;

                asset.Category = string.IsNullOrWhiteSpace(host.Category) ? "Unknown" : host.Category!;
                asset.Manufacturer = host.Manufacturer;
                asset.Model = host.Model;
                asset.Firmware = host.Firmware;
                asset.SerialNumber = host.SerialNumber;

                asset.WebPort = host.WebPort;
                asset.SdkPort = host.SdkPort;
                asset.Protocol = host.Protocol;
                asset.Status = host.Status;

                asset.OpenPortsJson = JsonSerializer.Serialize(host.OpenPorts ?? new List<int>());

                // Guardar credencial preferida si autenticó
                if (string.Equals(host.Status, "Authenticated", StringComparison.OrdinalIgnoreCase)
                    && host.CredentialId.HasValue)
                {
                    asset.PreferredCredentialId = host.CredentialId.Value;
                }
            }

            await _db.SaveChangesAsync(ct);
        }

        return Ok(response);
    }
}
