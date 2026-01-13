using System.Net;

namespace Inventario.Api.Services.Scan;

public sealed class DahuaCgiClient
{
    public async Task<(bool ok, int status, string body)> GetAsync(
        string ip,
        int port,
        bool https,
        string pathAndQuery,
        NetworkCredential? credential,
        CancellationToken ct)
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };

        if (credential is not null)
        {
            handler.Credentials = credential;
            handler.PreAuthenticate = true;
        }

        using var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(4) };

        var scheme = https ? "https" : "http";
        var url = $"{scheme}://{ip}:{port}{pathAndQuery}";

        try
        {
            using var resp = await http.GetAsync(url, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            return (resp.IsSuccessStatusCode, (int)resp.StatusCode, body);
        }
        catch (TaskCanceledException)
        {
            return (false, 0, "timeout");
        }
        catch (Exception ex)
        {
            return (false, 0, ex.Message);
        }
    }

    public static Dictionary<string, string> ParseKeyValues(string body)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var raw in body.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var line = raw.Trim();
            var idx = line.IndexOf('=');
            if (idx <= 0) continue;

            dict[line[..idx].Trim()] = line[(idx + 1)..].Trim();
        }

        return dict;
    }
}
