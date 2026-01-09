using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public class OnvifDiscoveryProtocolScanner : IProtocolScanner
{
    private readonly OnvifDiscoveryService _discovery;
    private Dictionary<string, OnvifDiscoveredDevice>? _cache;

    public OnvifDiscoveryProtocolScanner(OnvifDiscoveryService discovery)
    {
        _discovery = discovery;
    }

    public string Name => "Onvif";

    public bool CanTry(ScanHostResultDto host)
    {
        // Puede aplicarse a cualquier host; pero para no hacerlo por cada IP,
        // este scanner realmente trabaja con cache global.
        return true;
    }

    public async Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct)
    {
        // Ejecutamos discovery una sola vez por petición (cache en memoria)
        _cache ??= (await _discovery.DiscoverAsync(listenMs: 1200, ct))
            .ToDictionary(x => x.Ip, StringComparer.OrdinalIgnoreCase);

        if (!_cache.TryGetValue(host.Ip, out var dev))
            return null;

        // En esta primera iteración solo identificamos por presencia ONVIF
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
