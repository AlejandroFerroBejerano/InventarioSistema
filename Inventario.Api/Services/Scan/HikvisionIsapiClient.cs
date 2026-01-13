using System.Net;
using System.Text;
using System.Xml.Linq;

namespace Inventario.Api.Services.Scan;

public record HikvisionInfo(
    string? Model,
    string? Firmware,
    string? SerialNumber
);

public sealed class HikvisionIsapiClient
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromMilliseconds(2200);

    public async Task<HikvisionInfo?> TryGetDeviceInfoAsync(
        string ip,
        int port,
        bool https,
        string user,
        string pass,
        CancellationToken ct)
    {
        var url = BuildUrl(ip, port, https, "/ISAPI/System/deviceInfo");

        using var http = CreateHttpClient(user, pass);

        using var res = await http.GetAsync(url, ct);
        if (!res.IsSuccessStatusCode) return null;

        // Evita problemas de charset: leemos bytes y decodificamos a UTF-8
        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        var xml = Encoding.UTF8.GetString(bytes);

        return ParseDeviceInfo(xml);
    }

    private static HikvisionInfo? ParseDeviceInfo(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            var root = doc.Root;
            if (root is null) return null;

            // Ignorar namespaces: usamos LocalName
            string? Get(string localName) =>
                root.Descendants()
                    .FirstOrDefault(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase))
                    ?.Value
                    ?.Trim();

            var model = Get("model");
            var serial = Get("serialNumber") ?? Get("deviceID");

            var fw = Get("firmwareVersion");
            var fwBuild = Get("firmwareReleasedDate"); // ej: "build 220112"

            string? firmware = null;
            if (!string.IsNullOrWhiteSpace(fw))
            {
                firmware = string.IsNullOrWhiteSpace(fwBuild)
                    ? fw
                    : $"{fw} ({fwBuild})";
            }

            if (string.IsNullOrWhiteSpace(model) &&
                string.IsNullOrWhiteSpace(serial) &&
                string.IsNullOrWhiteSpace(firmware))
                return null;

            return new HikvisionInfo(model, firmware, serial);
        }
        catch
        {
            return null;
        }
    }

    private static HttpClient CreateHttpClient(string user, string pass)
    {
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false,
            PreAuthenticate = false,
            Credentials = new NetworkCredential(user, pass),
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };

        return new HttpClient(handler) { Timeout = RequestTimeout };
    }

    private static string BuildUrl(string ip, int port, bool https, string path)
        => $"{(https ? "https" : "http")}://{ip}:{port}{path}";
}
