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
        ct.ThrowIfCancellationRequested();

        var abonado = request.AbonadoMm.Trim();
        if (string.IsNullOrWhiteSpace(abonado))
            return BadRequest("abonadoMm is required");

        // Obtener InstallationId una vez y reutilizarlo
        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == abonado)
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (!installationId.HasValue)
            return BadRequest("Installation not found for abonadoMm");

        // ✅ Si viene NetworkId, cargar CIDR desde BD y validar que pertenece a la instalación
        if (request.NetworkId.HasValue)
        {
            var network = await _db.Networks
                .AsNoTracking()
                .FirstOrDefaultAsync(n =>
                    n.Id == request.NetworkId.Value &&
                    n.InstallationId == installationId.Value,
                    ct);

            if (network is null)
                return BadRequest("NetworkId not found for this abonadoMm");

            request.NetworkCidr = network.Cidr;
        }

        var cidr = request.NetworkCidr.Trim();
        if (string.IsNullOrWhiteSpace(cidr))
            return BadRequest("networkCidr is required");

        var ips = CidrHelper.Expand(cidr);

        var ports = (request.Ports is { Count: > 0 } ? request.Ports : DefaultPorts)
            .Distinct()
            .Where(p => p is > 0 and < 65536)
            .ToList();

        var response = new ScanResponseDto
        {
            AbonadoMm = abonado,
            NetworkCidr = cidr,
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

        // 3) Intentar protocolos por host
        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            // Garantizar OpenPorts no-null
            host.OpenPorts ??= new List<int>();
            var openPorts = host.OpenPorts;

            // Buscar asset existente para obtener credencial preferida (si existe)
            SystemAsset? existingAsset = await _db.SystemAssets
                .AsNoTracking()
                .FirstOrDefaultAsync(a =>
                    a.InstallationId == installationId.Value &&
                    a.IpAddress == host.Ip,
                    ct);

            var preferredCredentialId = existingAsset?.PreferredCredentialId;

            // Obtener credenciales (preferida primero si existe)
            var creds = await _credentialProvider.GetActiveCredentialsAsync(
                abonado,
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

            // Si no hay puertos abiertos no probamos protocolos
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
        // Persistencia: ScanRun (histórico de ejecuciones)
        // -----------------------------
        var totalHosts = hosts.Count;
        var noPortsCount = hosts.Count(h => string.Equals(h.Status, "NoPorts", StringComparison.OrdinalIgnoreCase));
        var identifiedCount = hosts.Count(h => string.Equals(h.Status, "Identified", StringComparison.OrdinalIgnoreCase));
        var authenticatedCount = hosts.Count(h => string.Equals(h.Status, "Authenticated", StringComparison.OrdinalIgnoreCase));

        var scanRun = new ScanRun
        {
            InstallationId = installationId.Value, // ya lo tienes calculado en tu controller
            NetworkId = request.NetworkId,          // puede ser null si venía CIDR directo
            NetworkCidr = response.NetworkCidr,
            StartedAt = response.StartedAt,
            FinishedAt = response.FinishedAt,
            TotalHosts = totalHosts,
            NoPortsCount = noPortsCount,
            IdentifiedCount = identifiedCount,
            AuthenticatedCount = authenticatedCount,
            CreatedAt = DateTime.UtcNow
        };

        _db.ScanRuns.Add(scanRun);
        await _db.SaveChangesAsync(ct);

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[SCAN] ScanRun saved. Id={scanRun.Id} Total={scanRun.TotalHosts} Auth={scanRun.AuthenticatedCount} Ident={scanRun.IdentifiedCount} NoPorts={scanRun.NoPortsCount}");
        Console.ResetColor();

        var hostResults = hosts.Select(h => new ScanHostResult
        {
            ScanRunId = scanRun.Id,
            IpAddress = h.Ip,
            Status = string.IsNullOrWhiteSpace(h.Status) ? "Found" : h.Status!,
            OpenPortsJson = JsonSerializer.Serialize(h.OpenPorts ?? new List<int>()),
            Manufacturer = h.Manufacturer,
            Model = h.Model,
            Firmware = h.Firmware,
            SerialNumber = h.SerialNumber,
            Protocol = h.Protocol,
            WebPort = h.WebPort,
            SdkPort = h.SdkPort,
            CredentialId = h.CredentialId,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _db.ScanHostResults.AddRange(hostResults);
        await _db.SaveChangesAsync(ct);

        return Ok(response);
    }
}
