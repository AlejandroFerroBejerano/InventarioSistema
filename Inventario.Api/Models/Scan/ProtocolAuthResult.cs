namespace Inventario.Api.Services.Scan;

public record ProtocolAuthResult(
    bool Success,
    string Protocol,
    string? Manufacturer,
    string? Model,
    string? Firmware,
    string? SerialNumber,
    int? WebPort,
    int? SdkPort,
    int? CredentialId,
    string? CredentialUsername
);