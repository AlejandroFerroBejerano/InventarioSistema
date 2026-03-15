namespace Inventario.Api.Models.Auth;

public class MfaSetupResponse
{
    public string UserId { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string? ManualEntryCode { get; set; }
    public string? QrCodeUri { get; set; }
}

