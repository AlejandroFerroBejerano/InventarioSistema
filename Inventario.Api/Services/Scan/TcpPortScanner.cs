using System.Net;
using System.Net.Sockets;

namespace Inventario.Api.Services.Scan;
//TCP port scan (rápido y concurrente)
public class TcpPortScanner
{
    public async Task<List<int>> ScanOpenPortsAsync(
        IPAddress ip,
        IEnumerable<int> ports,
        int connectTimeoutMs,
        int maxConcurrency,
        CancellationToken ct)
    {
        var open = new List<int>();
        using var semaphore = new SemaphoreSlim(maxConcurrency);

        var tasks = ports.Select(async port =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                if (await IsPortOpenAsync(ip, port, connectTimeoutMs, ct))
                {
                    lock (open) open.Add(port);
                }
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
        open.Sort();
        return open;
    }

    private static async Task<bool> IsPortOpenAsync(IPAddress ip, int port, int timeoutMs, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(ip, port);

            var completed = await Task.WhenAny(connectTask, Task.Delay(timeoutMs, ct));
            if (completed != connectTask) return false;

            await connectTask; // si falló, lanzará excepción
            return client.Connected;
        }
        catch
        {
            return false;
        }
    }
}
