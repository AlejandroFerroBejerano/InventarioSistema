using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public class OnvifProtocolScanner : IProtocolScanner
{
    private readonly OnvifDiscoveryService _discovery;
    private readonly OnvifDeviceClient _deviceClient;

    private Dictionary<string, OnvifDiscoveredDevice>? _cache;

    public OnvifProtocolScanner(OnvifDiscoveryService discovery, OnvifDeviceClient deviceClient)
    {
        _discovery = discovery;
        _deviceClient = deviceClient;
    }

    public string Name => "Onvif";

    public bool CanTry(ScanHostResultDto host)
    {
        // ONVIF puede existir aunque no detectes 80/443 en tu lista;
        // pero Discovery trabaja a UDP 3702, así que puede aplicar siempre.
        return true;
    }

    public async Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct)
    {
        // Discovery una sola vez por request (cache)
        _cache ??= (await _discovery.DiscoverAsync(listenMs: 1200, ct))
            .ToDictionary(x => x.Ip, StringComparer.OrdinalIgnoreCase);

        if (!_cache.TryGetValue(host.Ip, out var dev) || dev.XAddrs.Count == 0)
            return null;

        // Si no hay credenciales, al menos identificamos que es ONVIF
        if (credentials.Count == 0)
        {
            return new ProtocolAuthResult(
                Success: true,
                Protocol: "OnvifDiscovery",
                Manufacturer: "ONVIF",
                Model: null,
                Firmware: null,
                SerialNumber: null,
                WebPort: host.WebPort,
                SdkPort: 3702,
                CredentialId: null,
                CredentialUsername: null
            );
        }

        // Intento de autenticación real vía GetDeviceInformation
        foreach (var xaddr in dev.XAddrs)
        {
            foreach (var cred in credentials)
            {
                var info = await _deviceClient.GetDeviceInformationAsync(xaddr, cred.Username, cred.Password, ct);
                if (info is null) continue;

                return new ProtocolAuthResult(
                    Success: true,
                    Protocol: "OnvifDevice",
                    Manufacturer: info.Manufacturer ?? "ONVIF",
                    Model: info.Model,
                    Firmware: info.FirmwareVersion,
                    SerialNumber: info.SerialNumber,
                    WebPort: host.WebPort,
                    SdkPort: 3702,
                    CredentialId: cred.CredentialId,
                    CredentialUsername: cred.Username
                );
            }
        }

        // Discovery ok pero auth no
        return new ProtocolAuthResult(
            Success: true,
            Protocol: "OnvifDiscovery",
            Manufacturer: "ONVIF",
            Model: null,
            Firmware: null,
            SerialNumber: null,
            WebPort: host.WebPort,
            SdkPort: 3702,
            CredentialId: null,
            CredentialUsername: null
        );
    }
}
