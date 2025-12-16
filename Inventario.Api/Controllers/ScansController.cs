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

    public ScansController(DiscoveryService discovery)
    {
        _discovery = discovery;
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

        var hosts = await _discovery.DiscoverAsync(
            ips: ips,
            ports: ports,
            connectTimeoutMs: request.ConnectTimeoutMs,
            maxConcurrency: request.MaxConcurrency,
            useSsdp: request.UseSsdp,
            ssdpListenMs: request.SsdpListenMs,
            ct: ct);

        response.Hosts = hosts;
        response.FinishedAt = DateTime.UtcNow;

        return Ok(response);
    }
}
