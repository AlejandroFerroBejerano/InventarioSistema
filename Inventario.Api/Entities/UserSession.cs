namespace Inventario.Api.Entities;

public class UserSession
{
    public int Id { get; set; }

    public string SessionId { get; set; } = Guid.NewGuid().ToString("N");

    public string? UserId { get; set; }

    public string? RefreshTokenHash { get; set; }

    public string? ClientIp { get; set; }

    public string? UserAgent { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime LastActiveAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddDays(7);

    public bool IsRevoked { get; set; }

    public DateTime? RevokedAtUtc { get; set; }

    public string? RevokedByUserId { get; set; }
}
