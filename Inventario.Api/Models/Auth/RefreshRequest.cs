namespace Inventario.Api.Models.Auth;

public class RefreshRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
}
