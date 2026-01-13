using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public sealed class AxisVapixProtocolScanner : IProtocolScanner
{
    private readonly AxisVapixClient _axis;

    public AxisVapixProtocolScanner(AxisVapixClient axis)
    {
        _axis = axis;
    }

    public string Name => "AxisVapix";

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
        var ports = host.OpenPorts ?? new List<int>();

        // HTTPS primero si existe; luego HTTP
        var tries = new List<(int port, bool https)>();
        if (ports.Contains(443)) tries.Add((443, true));
        if (ports.Contains(80)) tries.Add((80, false));

        foreach (var (port, https) in tries)
        {
            foreach (var cred in credentials)
            {
                var info = await _axis.TryGetAxisInfoAsync(
                    host.Ip,
                    port,
                    https,
                    cred.Username,
                    cred.Password,
                    ct);

                if (info is null) continue;

                return new ProtocolAuthResult(
                    Success: true,
                    Protocol: Name,
                    Manufacturer: "Axis",
                    Model: info.Model,
                    Firmware: info.Firmware,
                    SerialNumber: info.SerialNumber,
                    WebPort: port,
                    SdkPort: null,
                    CredentialId: cred.CredentialId,
                    CredentialUsername: cred.Username
                );
            }
        }

        return null;
    }
}
