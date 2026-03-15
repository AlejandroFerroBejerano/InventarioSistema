using Inventario.Api.Data;
using Inventario.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Services.Security;

public interface IUserSessionService
{
    Task<bool> IsActiveAsync(string sessionId);
    Task<UserSession?> GetAsync(string sessionId);
    Task RevokeAsync(string sessionId, string? revokedByUserId = null);
    Task MarkActiveAsync(string sessionId);
    Task<UserSession> CreateAsync(string userId, string refreshTokenHash, string? clientIp, string? userAgent, DateTime expiresAtUtc);
}

public class UserSessionService : IUserSessionService
{
    private readonly InventarioDbContext _db;

    public UserSessionService(InventarioDbContext db)
    {
        _db = db;
    }

    public Task<UserSession?> GetAsync(string sessionId)
    {
        return _db.UserSessions.AsNoTracking().FirstOrDefaultAsync(x => x.SessionId == sessionId);
    }

    public async Task<bool> IsActiveAsync(string sessionId)
    {
        var session = await _db.UserSessions.AsNoTracking().FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (session is null)
            return false;

        if (session.IsRevoked)
            return false;

        if (session.ExpiresAtUtc < DateTime.UtcNow)
            return false;

        return true;
    }

    public async Task<UserSession> CreateAsync(string userId, string refreshTokenHash, string? clientIp, string? userAgent, DateTime expiresAtUtc)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        var session = new UserSession
        {
            SessionId = sessionId,
            UserId = userId,
            RefreshTokenHash = refreshTokenHash,
            ClientIp = clientIp,
            UserAgent = userAgent,
            CreatedAtUtc = now,
            LastActiveAtUtc = now,
            ExpiresAtUtc = expiresAtUtc,
            IsRevoked = false
        };

        _db.UserSessions.Add(session);
        await _db.SaveChangesAsync();

        return session;
    }

    public async Task RevokeAsync(string sessionId, string? revokedByUserId = null)
    {
        var session = await _db.UserSessions.FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (session is null || session.IsRevoked)
            return;

        session.IsRevoked = true;
        session.RevokedAtUtc = DateTime.UtcNow;
        session.RevokedByUserId = revokedByUserId;

        await _db.SaveChangesAsync();
    }

    public async Task MarkActiveAsync(string sessionId)
    {
        var session = await _db.UserSessions.FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (session is null)
            return;

        session.LastActiveAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
