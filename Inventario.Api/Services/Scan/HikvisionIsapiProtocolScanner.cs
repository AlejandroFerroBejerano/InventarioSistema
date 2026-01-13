using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public sealed class HikvisionIsapiProtocolScanner : IProtocolScanner
{
    private readonly HikvisionIsapiClient _client;

    public HikvisionIsapiProtocolScanner(HikvisionIsapiClient client)
    {
        _client = client;
    }

    public string Name => "HikvisionIsapi";

    public bool CanTry(ScanHostResultDto host)
    {
        var ports = host.OpenPorts ?? new List<int>();
        return ports.Contains(80) || ports.Contains(443);
    }

    public async Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct)
    {
        var openPorts = host.OpenPorts ?? new List<int>();

        // HTTPS primero, luego HTTP
        var webPorts = new List<(int port, bool https)>();
        if (openPorts.Contains(443)) webPorts.Add((443, true));
        if (openPorts.Contains(80))  webPorts.Add((80, false));

        foreach (var (port, https) in webPorts)
        {
            foreach (var cred in credentials)
            {
                var info = await _client.TryGetDeviceInfoAsync(
                    host.Ip,
                    port,
                    https,
                    cred.Username,
                    cred.Password,
                    ct);

                if (info is null) continue;

                // Hikvision SDK común en 8000 (si está abierto lo guardamos)
                var sdkPort = openPorts.Contains(8000) ? 8000 : (int?)null;

                return new ProtocolAuthResult(
                    Success: true,
                    Protocol: Name,
                    Manufacturer: "Hikvision",
                    Model: info.Model,
                    Firmware: info.Firmware,
                    SerialNumber: info.SerialNumber,
                    WebPort: port,
                    SdkPort: sdkPort,
                    CredentialId: cred.CredentialId,
                    CredentialUsername: cred.Username
                );
            }
        }

        return null;
    }
}
