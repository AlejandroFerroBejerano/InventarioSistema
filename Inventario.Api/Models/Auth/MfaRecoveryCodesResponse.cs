namespace Inventario.Api.Models.Auth;

public class MfaRecoveryCodesResponse
{
    public string[] RecoveryCodes { get; set; } = Array.Empty<string>();
}

