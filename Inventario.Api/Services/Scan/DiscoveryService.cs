using System.Net;
using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;
//DiscoveryService une TCP + SSDP
public class DiscoveryService
{
    private readonly TcpPortScanner _tcp;
    private readonly SsdpDiscovery _ssdp;

    public DiscoveryService(TcpPortScanner tcp, SsdpDiscovery ssdp)
    {
        _tcp = tcp;
        _ssdp = ssdp;
    }

    public async Task<List<ScanHostResultDto>> DiscoverAsync(
        List<IPAddress> ips,
        List<int> ports,
        int connectTimeoutMs,
        int maxConcurrency,
        bool useSsdp,
        int ssdpListenMs,
        CancellationToken ct)
    {
        Dictionary<string, SsdpInfoDto> ssdpMap = new(StringComparer.OrdinalIgnoreCase);

        // SSDP en paralelo (no depende de IPs)
        Task<Dictionary<string, SsdpInfoDto>>? ssdpTask = null;
        if (useSsdp)
            ssdpTask = _ssdp.DiscoverAsync(ssdpListenMs, ct);

        var results = new List<ScanHostResultDto>(ips.Count);

        // Scan TCP por IP, en serie por IP pero con concurrencia interna por puertos (MVP simple).
        foreach (var ip in ips)
        {
            ct.ThrowIfCancellationRequested();

            var open = await _tcp.ScanOpenPortsAsync(ip, ports, connectTimeoutMs, maxConcurrency, ct);

            results.Add(new ScanHostResultDto
            {
                Ip = ip.ToString(),
                OpenPorts = open,
                Status = open.Count > 0 ? "Found" : "NoPorts"
            });
        }

        if (ssdpTask is not null)
            ssdpMap = await ssdpTask;

        // Enriquecemos con SSDP
        foreach (var r in results)
        {
            if (ssdpMap.TryGetValue(r.Ip, out var info))
            {
                r.Ssdp = info;
                if (r.OpenPorts.Count == 0)
                    r.Status = "SsdpOnly";
            }
        }

        return results;
    }
}
