using System.Net.Http.Headers;
using System.Text;

namespace Inventario.Api.Services.Scan;

public record AxisInfo(string? Model, string? Firmware);

public class AxisVapixClient
{
    private readonly HttpClient _http;

    public AxisVapixClient(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromMilliseconds(1200);
    }

    public async Task<AxisInfo?> TryGetBasicInfoAsync(
        string ip,
        int port,
        bool https,
        string user,
        string pass,
        CancellationToken ct)
    {
        var scheme = https ? "https" : "http";
        var url = $"{scheme}://{ip}:{port}/axis-cgi/param.cgi?action=list&group=Properties.System";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{user}:{pass}")));

        using var res = await _http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;

        var text = await res.Content.ReadAsStringAsync(ct);

        var model = Extract(text, "Properties.System.ProductName")
                    ?? Extract(text, "Properties.System.ProductNumber");
        var fw = Extract(text, "Properties.System.Firmware.Version");

        return new AxisInfo(model, fw);
    }

    private static string? Extract(string payload, string key)
    {
        foreach (var line in payload.Split('\n'))
        {
            var trimmed = line.Trim();
            if (!trimmed.StartsWith(key + "=", StringComparison.OrdinalIgnoreCase)) continue;
            return trimmed[(key.Length + 1)..].Trim();
        }
        return null;
    }
}
