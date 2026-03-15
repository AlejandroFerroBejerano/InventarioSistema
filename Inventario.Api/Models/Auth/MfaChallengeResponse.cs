namespace Inventario.Api.Models.Auth;

public class MfaChallengeResponse
{
    public bool RequiresMfa { get; set; } = true;
    public string MfaChallengeToken { get; set; } = string.Empty;
    public DateTime MfaChallengeExpiresAtUtc { get; set; }
    public string Message { get; set; } = "MFA code required.";
}

