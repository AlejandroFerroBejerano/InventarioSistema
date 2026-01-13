using System.Net;
using System.Text;
using System.Text.Json;

namespace Inventario.Api.Services.Scan;

public record AxisInfo(string? Model, string? Firmware, string? SerialNumber);

public sealed class AxisVapixClient
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromMilliseconds(2200);

    public async Task<AxisInfo?> TryGetAxisInfoAsync(
        string ip,
        int port,
        bool https,
        string user,
        string pass,
        CancellationToken ct)
    {
        // 1) API moderna (Basic Device Info)
        var basic = await TryBasicDeviceInfoAsync(ip, port, https, user, pass, ct);
        if (basic is not null)
            return basic;

        // 2) Fallback legacy param.cgi
        return await TryParamCgiAsync(ip, port, https, user, pass, ct);
    }

    // =========================================================
    // BASIC DEVICE INFORMATION API
    // POST /axis-cgi/basicdeviceinfo.cgi
    // =========================================================
    private async Task<AxisInfo?> TryBasicDeviceInfoAsync(
        string ip,
        int port,
        bool https,
        string user,
        string pass,
        CancellationToken ct)
    {
        var url = BuildUrl(ip, port, https, "/axis-cgi/basicdeviceinfo.cgi");

        var handler = CreateDigestHandler(user, pass);
        using var http = new HttpClient(handler) { Timeout = RequestTimeout };

        // Nota: apiVersion "1.0" funciona en tu Q1941-E (devuelve apiVersion 1.1 en respuesta)
        var payload = new
        {
            apiVersion = "1.0",
            context = "inventario-scan",
            method = "getAllProperties"
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json")
        };

        using var res = await http.SendAsync(req, ct);

        // Redirect manual (mantiene Digest)
        if ((int)res.StatusCode is 301 or 302 or 303 or 307 or 308)
        {
            var loc = res.Headers.Location?.ToString();
            if (!string.IsNullOrWhiteSpace(loc))
            {
                using var req2 = new HttpRequestMessage(HttpMethod.Post, loc)
                {
                    Content = new StringContent(
                        JsonSerializer.Serialize(payload),
                        Encoding.UTF8,
                        "application/json")
                };

                using var res2 = await http.SendAsync(req2, ct);
                if (!res2.IsSuccessStatusCode) return null;

                var json2 = await ReadBodyAsUtf8SafeAsync(res2.Content, ct);
                return ParseBasicDeviceInfo(json2);
            }
        }

        if (!res.IsSuccessStatusCode)
            return null;

        var json = await ReadBodyAsUtf8SafeAsync(res.Content, ct);
        return ParseBasicDeviceInfo(json);
    }

    // ✅ Preferencia de modelo: ProdNbr (estable y corto)
    // JSON observado:
    // { "apiVersion": "1.1", "data": { "propertyList": { ... } } }
    private static AxisInfo? ParseBasicDeviceInfo(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("data", out var data))
                return null;

            if (!data.TryGetProperty("propertyList", out var props))
                return null;

            // MODELO: prioridad absoluta ProdNbr
            var model = GetString(props, "ProdNbr");

            // FIRMWARE: Version + BuildDate
            var version = GetString(props, "Version");
            var build = GetString(props, "BuildDate");

            string? firmware = null;
            if (!string.IsNullOrWhiteSpace(version))
            {
                firmware = string.IsNullOrWhiteSpace(build)
                    ? version
                    : $"{version} ({build})";
            }

            // SERIAL
            var serial =
                GetString(props, "SerialNumber") ??
                GetString(props, "SocSerialNumber");

            if (string.IsNullOrWhiteSpace(model) &&
                string.IsNullOrWhiteSpace(firmware) &&
                string.IsNullOrWhiteSpace(serial))
                return null;

            return new AxisInfo(model, firmware, serial);
        }
        catch
        {
            return null;
        }
    }

    private static string? GetString(JsonElement obj, string name)
    {
        if (obj.ValueKind != JsonValueKind.Object) return null;
        if (!obj.TryGetProperty(name, out var v)) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
    }

    // =========================================================
    // LEGACY VAPIX param.cgi (fallback)
    // =========================================================
    private async Task<AxisInfo?> TryParamCgiAsync(
        string ip,
        int port,
        bool https,
        string user,
        string pass,
        CancellationToken ct)
    {
        var handler = CreateDigestHandler(user, pass);
        using var http = new HttpClient(handler) { Timeout = RequestTimeout };

        var systemUrl = BuildUrl(ip, port, https,
            "/axis-cgi/param.cgi?action=list&group=Properties.System");

        var systemText = await GetTextWithOptionalRedirectAsync(http, systemUrl, ct);
        if (systemText is null) return null;

        var model =
            Extract(systemText, "Properties.System.ProductNumber") ??
            Extract(systemText, "Properties.System.ProductName");

        var serial =
            Extract(systemText, "Properties.System.SerialNumber");

        var fwUrl = BuildUrl(ip, port, https,
            "/axis-cgi/param.cgi?action=list&group=Properties.Firmware");

        var fwText = await GetTextWithOptionalRedirectAsync(http, fwUrl, ct);

        string? firmware = null;
        if (!string.IsNullOrWhiteSpace(fwText))
        {
            var ver = Extract(fwText, "Properties.Firmware.Version");
            var build = Extract(fwText, "Properties.Firmware.BuildDate");

            firmware = string.IsNullOrWhiteSpace(ver)
                ? null
                : string.IsNullOrWhiteSpace(build)
                    ? ver
                    : $"{ver} ({build})";
        }

        if (string.IsNullOrWhiteSpace(model) &&
            string.IsNullOrWhiteSpace(firmware) &&
            string.IsNullOrWhiteSpace(serial))
            return null;

        return new AxisInfo(model, firmware, serial);
    }

    // =========================================================
    // Helpers
    // =========================================================
    private static HttpClientHandler CreateDigestHandler(string user, string pass)
        => new()
        {
            AllowAutoRedirect = false,
            PreAuthenticate = false,
            Credentials = new NetworkCredential(user, pass),
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };

    private static string BuildUrl(string ip, int port, bool https, string pathAndQuery)
    {
        var scheme = https ? "https" : "http";
        return $"{scheme}://{ip}:{port}{pathAndQuery}";
    }

    private static async Task<string?> GetTextWithOptionalRedirectAsync(
        HttpClient http,
        string url,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        using var res = await http.SendAsync(req, ct);

        if ((int)res.StatusCode is 301 or 302 or 303 or 307 or 308)
        {
            var loc = res.Headers.Location?.ToString();
            if (!string.IsNullOrWhiteSpace(loc))
            {
                using var req2 = new HttpRequestMessage(HttpMethod.Get, loc);
                using var res2 = await http.SendAsync(req2, ct);
                if (!res2.IsSuccessStatusCode) return null;
                return await ReadBodyAsUtf8SafeAsync(res2.Content, ct);
            }
        }

        if (!res.IsSuccessStatusCode) return null;
        return await ReadBodyAsUtf8SafeAsync(res.Content, ct);
    }

    // Acepta "key=" y "root.key="
    private static string? Extract(string payload, string key)
    {
        foreach (var line in payload.Split('\n'))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) continue;

            if (trimmed.StartsWith(key + "=", StringComparison.OrdinalIgnoreCase))
                return trimmed[(key.Length + 1)..].Trim();

            var rootKey = "root." + key;
            if (trimmed.StartsWith(rootKey + "=", StringComparison.OrdinalIgnoreCase))
                return trimmed[(rootKey.Length + 1)..].Trim();
        }

        return null;
    }

    // Fix robusto para Content-Type con charset inválido (ej. "utf8")
    private static async Task<string> ReadBodyAsUtf8SafeAsync(
        HttpContent content,
        CancellationToken ct)
    {
        var bytes = await content.ReadAsByteArrayAsync(ct);

        try
        {
            var charset = content.Headers.ContentType?.CharSet;
            if (!string.IsNullOrWhiteSpace(charset))
            {
                if (charset.Equals("utf8", StringComparison.OrdinalIgnoreCase))
                    charset = "utf-8";

                var enc = Encoding.GetEncoding(charset);
                return enc.GetString(bytes);
            }
        }
        catch
        {
            // ignoramos y caemos a UTF-8
        }

        return Encoding.UTF8.GetString(bytes);
    }
}
