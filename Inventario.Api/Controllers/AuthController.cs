using System.Security.Claims;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Auth;
using Inventario.Api.Security;
using Inventario.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

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
    private readonly JwtSettings _jwtSettings;
    private readonly HashSet<string> _mandatoryMfaRoles;
    private readonly bool _enforceMandatoryForPrivileged;

    public AuthController(
        InventarioDbContext db,
        UserManager<ApplicationUser> userManager,
        IJwtTokenService jwt,
        IUserSessionService sessions,
        IAuditService audit,
        IOptions<JwtSettings> jwtSettings,
        IConfiguration configuration)
    {
        _db = db;
        _userManager = userManager;
        _jwt = jwt;
        _sessions = sessions;
        _audit = audit;
        _jwtSettings = jwtSettings.Value;

        var configuredRoles = configuration.GetSection("Security:Mfa:MandatoryRoles").Get<string[]>();
        _mandatoryMfaRoles = (configuredRoles is { Length: > 0 } ? configuredRoles : new[]
        {
            AuthRoles.GlobalAdmin,
            AuthRoles.TechnicalAdmin
        }).ToHashSet(StringComparer.OrdinalIgnoreCase);

        _enforceMandatoryForPrivileged =
            configuration.GetValue<bool>("Security:Mfa:EnforceMandatoryForPrivileged");
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

        var roles = (await _userManager.GetRolesAsync(user)).ToArray();
        var mfaEnabled = await _userManager.GetTwoFactorEnabledAsync(user);
        var mfaRequired = IsMfaRequired(roles);

        if (mfaRequired && !mfaEnabled && _enforceMandatoryForPrivileged)
        {
            await _audit.WriteAsync(
                action: "Auth/Login",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { reason = "MfaRequired" });

            return StatusCode(StatusCodes.Status403Forbidden, new { message = "MFA is mandatory for this role." });
        }

        if (mfaEnabled)
        {
            var challengeToken = _jwt.GenerateMfaChallengeToken(user.Id, _jwtSettings.MfaChallengeMinutes);
            return Ok(new MfaChallengeResponse
            {
                RequiresMfa = true,
                Message = "MFA code required to continue.",
                MfaChallengeToken = challengeToken,
                MfaChallengeExpiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtSettings.MfaChallengeMinutes)
            });
        }

        await _userManager.ResetAccessFailedCountAsync(user);
        user.LastLoginUtc = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var response = await IssueSessionAsync(user, roles);
        await _audit.WriteAsync(
            action: "Auth/Login",
            actorType: "User",
            actorId: user.Id,
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { sessionId = response.SessionId });

        return Ok(response);
    }

    [HttpPost("mfa/verify")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> VerifyMfa([FromBody] MfaVerifyRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length < 6)
            return BadRequest(new { message = "Invalid MFA code." });

        var userId = _jwt.ValidateMfaChallengeToken(request.MfaChallengeToken);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized(new { message = "MFA challenge is invalid or expired." });

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized(new { message = "Invalid user." });

        var provider = request.UseRecoveryCode
            ? "RecoveryCode"
            : TokenOptions.DefaultAuthenticatorProvider;
        var code = request.Code.Trim().Replace(" ", string.Empty);

        var codeValid = request.UseRecoveryCode
            ? (await _userManager.RedeemTwoFactorRecoveryCodeAsync(user, code)).Succeeded
            : await _userManager.VerifyTwoFactorTokenAsync(user, provider, code);

        if (!codeValid)
        {
            await _audit.WriteAsync(
                action: "Auth/MfaVerify",
                actorType: "User",
                actorId: user.Id,
                resourceType: "User",
                resourceId: user.Id,
                result: "Failed",
                context: HttpContext,
                details: new { provider });

            return Unauthorized(new { message = "Invalid MFA code." });
        }

        var roles = (await _userManager.GetRolesAsync(user)).ToArray();

        await _userManager.ResetAccessFailedCountAsync(user);

        user.LastLoginUtc = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var response = await IssueSessionAsync(user, roles);
        await _audit.WriteAsync(
            action: "Auth/MfaVerify",
            actorType: "User",
            actorId: user.Id,
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { sessionId = response.SessionId });

        return Ok(response);
    }

    [HttpPost("mfa/setup")]
    [Authorize]
    public async Task<ActionResult<MfaSetupResponse>> GetMfaSetup([FromQuery] string? userId = null)
    {
        var target = await ResolveTargetUserAsync(userId);
        if (target is null)
            return NotFound();

        var issuer = _jwtSettings.Issuer;
        var label = Uri.EscapeDataString(target.UserName ?? target.Email ?? target.Id);
        var encodedIssuer = Uri.EscapeDataString(issuer);
        var key = await _userManager.GetAuthenticatorKeyAsync(target);

        if (string.IsNullOrWhiteSpace(key))
        {
            await _userManager.ResetAuthenticatorKeyAsync(target);
            key = await _userManager.GetAuthenticatorKeyAsync(target);
        }

        if (string.IsNullOrWhiteSpace(key))
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Could not create MFA secret." });

        var qrCodeUri = $"otpauth://totp/{encodedIssuer}:{label}?secret={key}&issuer={encodedIssuer}&digits=6&period=30&algorithm=SHA1";

        return Ok(new MfaSetupResponse
        {
            UserId = target.Id,
            IsEnabled = await _userManager.GetTwoFactorEnabledAsync(target),
            ManualEntryCode = key,
            QrCodeUri = qrCodeUri
        });
    }

    [HttpPost("mfa/confirm")]
    [Authorize]
    public async Task<ActionResult<MfaRecoveryCodesResponse>> ConfirmMfa([FromBody] MfaEnableRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var target = await ResolveTargetUserAsync(request.UserId);
        if (target is null)
            return NotFound();

        var canManageMfa = CanManageAnyUser();
        var currentUserId = GetCurrentUserId();
        if (!string.Equals(target.Id, currentUserId, StringComparison.Ordinal) && !canManageMfa)
        {
            return Forbid();
        }

        var code = request.Code.Replace(" ", string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "Code is required." });

        var codeValid = await _userManager.VerifyTwoFactorTokenAsync(
            target,
            TokenOptions.DefaultAuthenticatorProvider,
            code);

        if (!codeValid)
        {
            return BadRequest(new { message = "Invalid code." });
        }

        var enabled = await _userManager.GetTwoFactorEnabledAsync(target);
        if (!enabled)
        {
            await _userManager.SetTwoFactorEnabledAsync(target, true);
        }

        var recoveryCodes = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(target, 10);

        await _audit.WriteAsync(
            action: "Auth/MfaEnabled",
            actorType: "User",
            actorId: currentUserId,
            resourceType: "User",
            resourceId: target.Id,
            result: "Success",
            context: HttpContext);

        return Ok(new MfaRecoveryCodesResponse { RecoveryCodes = (recoveryCodes ?? Array.Empty<string>()).ToArray() });
    }

    [HttpPost("mfa/disable")]
    [Authorize]
    public async Task<IActionResult> DisableMfa([FromBody] MfaDisableRequest request)
    {
        var target = await ResolveTargetUserAsync(request.UserId);
        if (target is null)
            return NotFound();

        var currentUserId = GetCurrentUserId();
        var canManageMfa = CanManageAnyUser();
        if (!string.Equals(target.Id, currentUserId, StringComparison.Ordinal) && !canManageMfa)
        {
            return Forbid();
        }

        if (!await _userManager.GetTwoFactorEnabledAsync(target))
        {
            return NoContent();
        }

        await _userManager.SetTwoFactorEnabledAsync(target, false);
        await _userManager.ResetAuthenticatorKeyAsync(target);

        await _audit.WriteAsync(
            action: "Auth/MfaDisabled",
            actorType: "User",
            actorId: currentUserId,
            resourceType: "User",
            resourceId: target.Id,
            result: "Success",
            context: HttpContext);

        return NoContent();
    }

    [HttpPost("mfa/recovery")]
    [Authorize]
    public async Task<ActionResult<MfaRecoveryCodesResponse>> RegenerateRecoveryCodes([FromQuery] string? userId = null)
    {
        var target = await ResolveTargetUserAsync(userId);
        if (target is null)
            return NotFound();

        var canManageMfa = CanManageAnyUser();
        var currentUserId = GetCurrentUserId();
        if (!string.Equals(target.Id, currentUserId, StringComparison.Ordinal) && !canManageMfa)
        {
            return Forbid();
        }

        if (!await _userManager.GetTwoFactorEnabledAsync(target))
        {
            return BadRequest(new { message = "MFA is not enabled." });
        }

        var recoveryCodes = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(target, 10);

        await _audit.WriteAsync(
            action: "Auth/MfaRecoveryCodes",
            actorType: "User",
            actorId: currentUserId,
            resourceType: "User",
            resourceId: target.Id,
            result: "Success",
            context: HttpContext);

        return Ok(new MfaRecoveryCodesResponse { RecoveryCodes = (recoveryCodes ?? Array.Empty<string>()).ToArray() });
    }

    [HttpGet("mfa/status")]
    [Authorize]
    public async Task<IActionResult> GetMfaStatus([FromQuery] string? userId = null)
    {
        var target = await ResolveTargetUserAsync(userId);
        if (target is null)
            return NotFound();

        var canManageMfa = CanManageAnyUser();
        var currentUserId = GetCurrentUserId();
        if (!string.Equals(target.Id, currentUserId, StringComparison.Ordinal) && !canManageMfa)
        {
            return Forbid();
        }

        var isEnabled = await _userManager.GetTwoFactorEnabledAsync(target);
        return Ok(new
        {
            userId = target.Id,
            isEnabled,
            email = target.Email,
            mandatory = IsMfaRequired((await _userManager.GetRolesAsync(target)).ToArray())
        });
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
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

    private async Task<ApplicationUser?> ResolveTargetUserAsync(string? userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return await _userManager.FindByIdAsync(GetCurrentUserId() ?? string.Empty);
        }

        if (!CanManageAnyUser())
        {
            if (string.Equals(userId, GetCurrentUserId(), StringComparison.Ordinal))
            {
                return await _userManager.FindByIdAsync(userId);
            }

            return null;
        }

        return await _userManager.FindByIdAsync(userId);
    }

    private bool CanManageAnyUser()
    {
        return User.IsInRole(AuthRoles.GlobalAdmin) || User.IsInRole(AuthRoles.TechnicalAdmin);
    }

    private bool IsMfaRequired(IEnumerable<string> roles)
    {
        return roles.Any(role => _mandatoryMfaRoles.Contains(role));
    }

    private async Task<LoginResponse> IssueSessionAsync(ApplicationUser user, string[] roles)
    {
        var refreshToken = _jwt.GenerateRefreshToken();
        var refreshHash = _jwt.HashToken(refreshToken);
        var expiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays);

        var session = await _sessions.CreateAsync(user.Id, refreshHash, GetClientIp(), Request.Headers["User-Agent"].ToString(), expiresAt);
        var accessToken = _jwt.GenerateAccessToken(user, roles, session.SessionId);

        return BuildLoginResponse(user, roles, accessToken, session, refreshToken, session.ExpiresAtUtc);
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
