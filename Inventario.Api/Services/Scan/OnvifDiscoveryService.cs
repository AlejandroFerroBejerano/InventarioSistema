using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Xml;

namespace Inventario.Api.Services.Scan;

public record OnvifDiscoveredDevice(string Ip, List<string> XAddrs);

public class OnvifDiscoveryService
{
    // WS-Discovery multicast address
    private static readonly IPEndPoint WsDiscoveryEndpoint = new(IPAddress.Parse("239.255.255.250"), 3702);

    public async Task<List<OnvifDiscoveredDevice>> DiscoverAsync(int listenMs, CancellationToken ct)
    {
        var results = new Dictionary<string, OnvifDiscoveredDevice>(StringComparer.OrdinalIgnoreCase);

        using var udp = new UdpClient(AddressFamily.InterNetwork);
        udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        udp.EnableBroadcast = true;

        var messageId = Guid.NewGuid().ToString();
        var probe = BuildProbe(messageId);

        var bytes = Encoding.UTF8.GetBytes(probe);
        await udp.SendAsync(bytes, bytes.Length, WsDiscoveryEndpoint);

        var stopAt = DateTime.UtcNow.AddMilliseconds(listenMs);

        while (DateTime.UtcNow < stopAt && !ct.IsCancellationRequested)
        {
            var remaining = stopAt - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero) break;

            var receiveTask = udp.ReceiveAsync();
            var completed = await Task.WhenAny(receiveTask, Task.Delay(remaining, ct));
            if (completed != receiveTask) break;

            UdpReceiveResult packet;
            try { packet = await receiveTask; }
            catch { break; }

            var ip = packet.RemoteEndPoint.Address.ToString();
            var xmlText = Encoding.UTF8.GetString(packet.Buffer);

            var xaddrs = TryParseXAddrs(xmlText);
            if (xaddrs.Count == 0) continue;

            if (!results.TryGetValue(ip, out var dev))
            {
                dev = new OnvifDiscoveredDevice(ip, new List<string>());
                results[ip] = dev;
            }

            foreach (var xa in xaddrs)
                if (!dev.XAddrs.Contains(xa, StringComparer.OrdinalIgnoreCase))
                    dev.XAddrs.Add(xa);
        }

        return results.Values.ToList();
    }

    private static string BuildProbe(string messageId)
    {
        // Probe genérico para dispositivos ONVIF (dn:NetworkVideoTransmitter)
        // NOTA: hay distintas "Types"; éste es bastante común.
        return
$@"<?xml version=""1.0"" encoding=""UTF-8""?>
<e:Envelope xmlns:e=""http://www.w3.org/2003/05/soap-envelope""
            xmlns:w=""http://schemas.xmlsoap.org/ws/2004/08/addressing""
            xmlns:d=""http://schemas.xmlsoap.org/ws/2005/04/discovery""
            xmlns:dn=""http://www.onvif.org/ver10/network/wsdl"">
  <e:Header>
    <w:MessageID>uuid:{messageId}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>";
    }

    private static List<string> TryParseXAddrs(string xmlText)
    {
        var xaddrs = new List<string>();

        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xmlText);

            // Busca nodos XAddrs independientemente del namespace
            var nodes = doc.SelectNodes("//*[local-name()='XAddrs']");
            if (nodes is null) return xaddrs;

            foreach (XmlNode n in nodes)
            {
                var text = n.InnerText?.Trim();
                if (string.IsNullOrWhiteSpace(text)) continue;

                // XAddrs puede venir como lista separada por espacios
                foreach (var part in text.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    xaddrs.Add(part);
            }
        }
        catch
        {
            // ignoramos paquetes que no sean xml o no parseables
        }

        return xaddrs;
    }
}
