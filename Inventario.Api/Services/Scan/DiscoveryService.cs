using System.Net;
using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

// DiscoveryService une TCP + SSDP
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

        // Resultados thread-safe mediante lock
        var results = new List<ScanHostResultDto>(ips.Count);

        // Concurrencia por IP (limita carga global)
        var ipConcurrency = Math.Min(Math.Max(1, maxConcurrency), 512);
        using var ipSemaphore = new SemaphoreSlim(ipConcurrency);

        // Concurrencia por puertos dentro de cada IP (para evitar explosión de tareas)
        var perIpPortConcurrency = 20;

        var ipTasks = ips.Select(async ip =>
        {
            await ipSemaphore.WaitAsync(ct);
            try
            {
                ct.ThrowIfCancellationRequested();

                var open = await _tcp.ScanOpenPortsAsync(
                    ip,
                    ports,
                    connectTimeoutMs,
                    maxConcurrency: perIpPortConcurrency,
                    ct);

                var r = new ScanHostResultDto
                {
                    Ip = ip.ToString(),
                    OpenPorts = open,
                    Status = open.Count > 0 ? "Found" : "NoPorts"
                };

                lock (results)
                {
                    results.Add(r);
                }
            }
            finally
            {
                ipSemaphore.Release();
            }
        });

        await Task.WhenAll(ipTasks);

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

        // Orden estable por IP
        results.Sort((a, b) => CompareIp(a.Ip, b.Ip));

        return results;
    }

    private static int CompareIp(string a, string b)
    {
        // Ordenación numérica IPv4 (si falla, fallback string)
        if (IPAddress.TryParse(a, out var ipA) && IPAddress.TryParse(b, out var ipB))
        {
            var ba = ipA.GetAddressBytes();
            var bb = ipB.GetAddressBytes();
            if (ba.Length == 4 && bb.Length == 4)
            {
                for (int i = 0; i < 4; i++)
                {
                    var cmp = ba[i].CompareTo(bb[i]);
                    if (cmp != 0) return cmp;
                }
                return 0;
            }
        }
        return string.CompareOrdinal(a, b);
    }
}
