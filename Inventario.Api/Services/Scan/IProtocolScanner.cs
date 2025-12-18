using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public interface IProtocolScanner
{
    string Name { get; }

    // Decide rápido si tiene sentido intentarlo con la info disponible (puertos abiertos, ssdp, etc.)
    bool CanTry(ScanHostResultDto host);

    // Intenta identificar/autenticar usando la lista de credenciales (ya desencriptadas)
    Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct);
}
