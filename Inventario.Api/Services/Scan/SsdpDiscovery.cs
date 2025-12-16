using System.Net;
using System.Net.Sockets;
using System.Text;
using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;
//SSDP discovery (M-SEARCH + escucha)
public class SsdpDiscovery
{
    private static readonly IPEndPoint SsdpEndpoint = new(IPAddress.Parse("239.255.255.250"), 1900);

    public async Task<Dictionary<string, SsdpInfoDto>> DiscoverAsync(int listenMs, CancellationToken ct)
    {
        // Devuelve mapa IP -> info SSDP
        var found = new Dictionary<string, SsdpInfoDto>(StringComparer.OrdinalIgnoreCase);

        using var udp = new UdpClient(AddressFamily.InterNetwork);
        udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        udp.EnableBroadcast = true;

        // Mensaje M-SEARCH genérico
        var msg =
            "M-SEARCH * HTTP/1.1\r\n" +
            "HOST: 239.255.255.250:1900\r\n" +
            "MAN: \"ssdp:discover\"\r\n" +
            "MX: 1\r\n" +
            "ST: ssdp:all\r\n\r\n";

        var bytes = Encoding.ASCII.GetBytes(msg);
        await udp.SendAsync(bytes, bytes.Length, SsdpEndpoint);

        var stopAt = DateTime.UtcNow.AddMilliseconds(listenMs);

        while (DateTime.UtcNow < stopAt && !ct.IsCancellationRequested)
        {
            var remaining = stopAt - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero) break;

            var receiveTask = udp.ReceiveAsync();
            var completed = await Task.WhenAny(receiveTask, Task.Delay(remaining, ct));
            if (completed != receiveTask) break;

            var result = await receiveTask;
            var ip = result.RemoteEndPoint.Address.ToString();

            var text = Encoding.ASCII.GetString(result.Buffer);
            var headers = ParseHeaders(text);

            found[ip] = new SsdpInfoDto
            {
                Server = headers.TryGetValue("SERVER", out var server) ? server : null,
                Usn = headers.TryGetValue("USN", out var usn) ? usn : null,
                St = headers.TryGetValue("ST", out var st) ? st : null,
                Location = headers.TryGetValue("LOCATION", out var loc) ? loc : null
            };
        }

        return found;
    }

    private static Dictionary<string, string> ParseHeaders(string response)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var lines = response.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines.Skip(1)) // saltar la primera línea HTTP/1.1 200 OK
        {
            var idx = line.IndexOf(':');
            if (idx <= 0) continue;
            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim();
            dict[key] = value;
        }
        return dict;
    }
}
