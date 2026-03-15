namespace Inventario.Api.Models.Auth;

public class UserSessionDto
{
    public int Id { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastActiveAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? RevokedByUserId { get; set; }
    public string? ClientIp { get; set; }
    public string? UserAgent { get; set; }
}
