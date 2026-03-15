namespace Inventario.Api.Security;

public class JwtSettings
{
    public string Secret { get; set; } = "change-me-with-32-chars-minimum";
    public string Issuer { get; set; } = "Inventario.Api";
    public string Audience { get; set; } = "Inventario.Web";
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 7;
    public int MfaChallengeMinutes { get; set; } = 5;
}
