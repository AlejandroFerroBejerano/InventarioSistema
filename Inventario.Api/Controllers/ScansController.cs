using Inventario.Api.Models.Scan;
using Inventario.Api.Services.Scan;
using Microsoft.AspNetCore.Mvc;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScansController : ControllerBase
{
    private static readonly List<int> DefaultPorts = new() { 80, 443, 554, 8000, 8080, 37777, 8899 };

    private readonly DiscoveryService _discovery;
    private readonly CredentialProvider _credentialProvider;
    private readonly IEnumerable<IProtocolScanner> _protocolScanners;

    public ScansController(
        DiscoveryService discovery,
        CredentialProvider credentialProvider,
        IEnumerable<IProtocolScanner> protocolScanners)
    {
        _discovery = discovery;
        _credentialProvider = credentialProvider;
        _protocolScanners = protocolScanners;
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

        // 3) Obtener credenciales activas (una sola vez)
        var creds = await _credentialProvider.GetActiveCredentialsAsync(response.AbonadoMm, ct);

        // 4) Intentar protocolos por host (solo si hay algo prometedor)
        //    Nota: aquí lo dejamos simple (secuencial por host). Luego lo paralelizamos con SemaphoreSlim.
        foreach (var host in hosts)
        {
            ct.ThrowIfCancellationRequested();

            // Elegir WebPort por conveniencia (443 preferido)
            host.WebPort = host.OpenPorts.Contains(443) ? 443 :
                           host.OpenPorts.Contains(80) ? 80 : null;

            if (host.OpenPorts.Count == 0)
                continue; // nada que intentar ahora

            // Si no hay credenciales, igual podemos identificar sin auth en futuros protocolos,
            // pero para AxisVapix con auth necesitamos al menos una.
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
                break; // si uno funciona, paramos
            }
        }

        response.Hosts = hosts;
        response.FinishedAt = DateTime.UtcNow;

        return Ok(response);
    }
}
