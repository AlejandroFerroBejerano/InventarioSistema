using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public class AxisVapixProtocolScanner : IProtocolScanner
{
    private readonly AxisVapixClient _axis;

    public AxisVapixProtocolScanner(AxisVapixClient axis)
    {
        _axis = axis;
    }

    public string Name => "AxisVapix";

    public bool CanTry(ScanHostResultDto host)
        => host.OpenPorts.Contains(80) || host.OpenPorts.Contains(443);

    public async Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct)
    {
        var https = host.OpenPorts.Contains(443);
        var port = https ? 443 : 80;

        foreach (var cred in credentials)
        {
            var info = await _axis.TryGetBasicInfoAsync(
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
                WebPort: port,
                SdkPort: null,
                CredentialId: cred.CredentialId,
                CredentialUsername: cred.Username
            );
        }

        return null;
    }
}
