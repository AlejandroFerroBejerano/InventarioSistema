using System.Security.Claims;
using System.Text;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Auth;
using Inventario.Api.Security;
using Inventario.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly InventarioDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _jwt;
    private readonly IUserSessionService _sessions;
    private readonly IAuditService _audit;

    public AuthController(
        InventarioDbContext db,
        UserManager<ApplicationUser> userManager,
        IJwtTokenService jwt,
        IUserSessionService sessions,
        IAuditService audit)
    {
        _db = db;
        _userManager = userManager;
        _jwt = jwt;
        _sessions = sessions;
        _audit = audit;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: null,
                resourceType: "User",
                resourceId: request.Email,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "UserNotFound" });

            return Unauthorized(new { message = "Invalid credentials." });
        }

        if (!string.Equals(user.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "UserDisabled" });

            return Forbid($"User state is '{user.Status}'.");
        }

        if (user.IsDeleted)
        {
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "UserDeleted" });

            return Unauthorized(new { message = "Invalid credentials." });
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "LockedOut" });

            return Unauthorized(new { message = "Account is temporarily locked." });
        }

        var passwordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            await _userManager.AccessFailedAsync(user);
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "InvalidPassword" });

            return Unauthorized(new { message = "Invalid credentials." });
        }

        await _userManager.ResetAccessFailedCountAsync(user);
        user.LastLoginUtc = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var roles = (await _userManager.GetRolesAsync(user)).ToArray();
        var refreshToken = _jwt.GenerateRefreshToken();
        var refreshHash = _jwt.HashToken(refreshToken);
        var expiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays);

        var session = await _sessions.CreateAsync(user.Id, refreshHash, GetClientIp(), Request.Headers["User-Agent"].ToString(), expiresAt);
        var accessToken = _jwt.GenerateAccessToken(user, roles, session.SessionId);

        await _audit.WriteAsync(
            action: "Auth/Login",
            actorType: "User",
            actorId: user.Id,
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { sessionId = session.SessionId });

        return Ok(BuildLoginResponse(user, roles, accessToken, session, refreshToken, expiresAt));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId) || string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "SessionId and refreshToken are required." });

        var session = await _db.UserSessions.FirstOrDefaultAsync(x => x.SessionId == request.SessionId);
        if (session is null || session.IsRevoked || session.ExpiresAtUtc < DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Session is invalid or expired." });
        }

        var tokenHash = _jwt.HashToken(request.RefreshToken);
        if (!string.Equals(session.RefreshTokenHash, tokenHash, StringComparison.Ordinal))
        {
            return Unauthorized(new { message = "Invalid refresh token." });
        }

        var user = await _userManager.FindByIdAsync(session.UserId ?? string.Empty);
        if (user is null || user.IsDeleted || !string.Equals(user.Status, "Active", StringComparison.OrdinalIgnoreCase))
            return Unauthorized(new { message = "Session user is invalid." });

        var roles = (await _userManager.GetRolesAsync(user)).ToArray();
        var newAccessToken = _jwt.GenerateAccessToken(user, roles, session.SessionId);
        var newRefreshToken = _jwt.GenerateRefreshToken();
        session.RefreshTokenHash = _jwt.HashToken(newRefreshToken);
        session.ExpiresAtUtc = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays);
        session.LastActiveAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _audit.WriteAsync(
            action: "Auth/Refresh",
            actorType: "User",
            actorId: user.Id,
            resourceType: "UserSession",
            resourceId: session.SessionId,
            result: "Success",
            context: HttpContext);

        return Ok(BuildLoginResponse(user, roles, newAccessToken, session, newRefreshToken, session.ExpiresAtUtc));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RevokeSessionRequest request)
    {
        var currentSessionId = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
        if (!string.IsNullOrWhiteSpace(currentSessionId))
        {
            await _sessions.RevokeAsync(currentSessionId, GetCurrentUserId());
            await _audit.WriteAsync(
                "Auth/Logout",
                actorType: "User",
                actorId: GetCurrentUserId(),
                resourceType: "UserSession",
                resourceId: currentSessionId,
                result: "Success",
                context: HttpContext);
        }

        var target = request?.SessionId;
        if (!string.IsNullOrWhiteSpace(target) && !string.Equals(target, currentSessionId, StringComparison.Ordinal))
        {
            await _sessions.RevokeAsync(target, GetCurrentUserId());
        }

        return NoContent();
    }

    [HttpGet("sessions")]
    [Authorize]
    public async Task<ActionResult<List<UserSessionDto>>> GetSessions()
    {
        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole(AuthRoles.GlobalAdmin) || User.IsInRole(AuthRoles.TechnicalAdmin);

        var query = _db.UserSessions.AsNoTracking();
        if (!isAdmin)
            query = query.Where(x => x.UserId == userId);

        var sessions = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new UserSessionDto
            {
                Id = x.Id,
                SessionId = x.SessionId,
                CreatedAtUtc = x.CreatedAtUtc,
                LastActiveAtUtc = x.LastActiveAtUtc,
                ExpiresAtUtc = x.ExpiresAtUtc,
                IsRevoked = x.IsRevoked,
                RevokedAtUtc = x.RevokedAtUtc,
                RevokedByUserId = x.RevokedByUserId,
                ClientIp = x.ClientIp,
                UserAgent = x.UserAgent
            })
            .ToListAsync();

        return Ok(sessions);
    }

    private LoginResponse BuildLoginResponse(
        ApplicationUser user,
        string[] roles,
        string accessToken,
        UserSession session,
        string refreshToken,
        DateTime refreshTokenExpiresAtUtc)
    {
        return new LoginResponse
        {
            AccessToken = accessToken,
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes),
            SessionId = session.SessionId,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAtUtc = refreshTokenExpiresAtUtc,
            UserId = user.Id,
            DisplayName = user.DisplayName,
            Email = user.Email ?? string.Empty,
            Roles = roles
        };
    }

    private string? GetClientIp()
    {
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
