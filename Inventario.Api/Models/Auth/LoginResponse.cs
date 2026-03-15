namespace Inventario.Api.Models.Auth;

public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public DateTime ExpiresAtUtc { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime RefreshTokenExpiresAtUtc { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string[] Roles { get; set; } = System.Array.Empty<string>();

    public bool RequiresMfa { get; set; }
    public string? MfaChallengeToken { get; set; }
    public DateTime? MfaChallengeExpiresAtUtc { get; set; }
    public string? Message { get; set; }
}
