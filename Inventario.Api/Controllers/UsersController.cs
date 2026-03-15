using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Users;
using Inventario.Api.Security;
using Inventario.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ManageUsers)]
public class UsersController : ControllerBase
{
    private readonly InventarioDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAuditService _audit;

    public UsersController(InventarioDbContext db, UserManager<ApplicationUser> userManager, IAuditService audit)
    {
        _db = db;
        _userManager = userManager;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> Get(
        [FromQuery] string? status,
        [FromQuery] string? role,
        [FromQuery] DateTime? lastLoginFromUtc,
        [FromQuery] DateTime? lastLoginToUtc,
        [FromQuery] DateTime? createdFromUtc,
        [FromQuery] DateTime? createdToUtc,
        [FromQuery] bool includeDeleted = false)
    {
        var query = _userManager.Users.AsNoTracking();
        if (!includeDeleted)
        {
            query = query.Where(u => !u.IsDeleted);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(u => u.Status == status.Trim());
        }

        if (lastLoginFromUtc.HasValue)
        {
            query = query.Where(u => u.LastLoginUtc != null && u.LastLoginUtc >= lastLoginFromUtc.Value);
        }

        if (lastLoginToUtc.HasValue)
        {
            query = query.Where(u => u.LastLoginUtc != null && u.LastLoginUtc <= lastLoginToUtc.Value);
        }

        if (createdFromUtc.HasValue)
        {
            query = query.Where(u => u.CreatedAtUtc >= createdFromUtc.Value);
        }

        if (createdToUtc.HasValue)
        {
            query = query.Where(u => u.CreatedAtUtc <= createdToUtc.Value);
        }

        var users = await query.OrderBy(x => x.Email).ToListAsync();
        var result = new List<UserDto>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (!string.IsNullOrWhiteSpace(role) && !roles.Contains(role, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            result.Add(await MapAsync(user, roles));
        }

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request)
    {
        if (!TryValidateModel(request))
        {
            return ValidationProblem(ModelState);
        }

        if (!string.IsNullOrWhiteSpace(request.Role) &&
            !AuthRoles.All.Contains(request.Role, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid role." });
        }

        var email = request.Email.Trim();
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
            return Conflict(new { message = "User already exists." });

        var userName = (request.UserName ?? email).Trim();
        var user = new ApplicationUser
        {
            UserName = userName,
            Email = email,
            DisplayName = request.DisplayName?.Trim() ?? userName,
            Status = request.Status ?? "Active",
            OrganizationScope = request.OrganizationScope?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        var created = await _userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
        {
            return BadRequest(new { message = "User creation failed.", errors = created.Errors.Select(e => e.Description) });
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = AuthRoles.All.First(r =>
                string.Equals(r, request.Role!.Trim(), StringComparison.OrdinalIgnoreCase));

            await _userManager.AddToRoleAsync(user, role);
        }

        await _audit.WriteAsync(
            action: "Users/Create",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { email = user.Email });

        var roles = await _userManager.GetRolesAsync(user);
        return CreatedAtAction(nameof(Get), new { id = user.Id }, await MapAsync(user, roles));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> Update([Required] string id, [FromBody] UpdateUserRequest request)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            user.Email = request.Email?.Trim();
            user.NormalizedEmail = request.Email?.Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(request.UserName))
            {
                user.UserName = request.Email?.Trim();
                user.NormalizedUserName = request.Email?.Trim().ToUpperInvariant();
            }
            else
            {
                user.UserName = request.UserName.Trim();
                user.NormalizedUserName = request.UserName.Trim().ToUpperInvariant();
            }
        }

        if (!string.IsNullOrWhiteSpace(request.UserName))
        {
            user.UserName = request.UserName.Trim();
            user.NormalizedUserName = request.UserName.Trim().ToUpperInvariant();
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            user.DisplayName = request.DisplayName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            user.Status = request.Status.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.OrganizationScope))
        {
            user.OrganizationScope = request.OrganizationScope.Trim();
        }

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(new { message = "User update failed.", errors = updateResult.Errors.Select(e => e.Description) });

        var roleChanged = false;
        string? previousRole = null;
        string? targetRole = null;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var requestedRole = request.Role.Trim();
            targetRole = AuthRoles.All.FirstOrDefault(r =>
                string.Equals(r, requestedRole, StringComparison.OrdinalIgnoreCase));
            if (targetRole is null)
            {
                return BadRequest(new { message = "Invalid role." });
            }

            var currentRoles = await _userManager.GetRolesAsync(user);
            previousRole = currentRoles.FirstOrDefault();
            if (!currentRoles.Contains(targetRole, StringComparer.OrdinalIgnoreCase))
            {
                if (currentRoles.Count > 0)
                    await _userManager.RemoveFromRolesAsync(user, currentRoles);

                await _userManager.AddToRoleAsync(user, targetRole);
                roleChanged = true;
            }
        }

        await _audit.WriteAsync(
            action: roleChanged ? "Users/ChangeRole" : "Users/Update",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { email = user.Email, roleChanged, previousRole, targetRole });

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(await MapAsync(user, roles));
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> SetStatus([Required] string id, [FromBody] SetUserStatusRequest request)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound();

        user.Status = request.Status.Trim();

        if (!string.Equals(request.Status, "Deleted", StringComparison.OrdinalIgnoreCase))
        {
            user.IsDeleted = false;
            user.DeletedAtUtc = null;
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new { message = "Cannot update status.", errors = result.Errors.Select(e => e.Description) });

        if (string.Equals(request.Status, "Disabled", StringComparison.OrdinalIgnoreCase))
        {
            await RevokeAllSessions(user.Id);
            await _userManager.SetLockoutEnabledAsync(user, true);
            await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddYears(100));
        }
        else if (string.Equals(request.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);
        }

        await _audit.WriteAsync(
            action: "Users/SetStatus",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext,
            details: new { status = request.Status });

        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLogical([Required] string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return NotFound();

        user.IsDeleted = true;
        user.Status = "Deleted";
        user.DeletedAtUtc = DateTime.UtcNow;

        var updated = await _userManager.UpdateAsync(user);
        if (!updated.Succeeded)
            return BadRequest(new { message = "Cannot delete user.", errors = updated.Errors.Select(e => e.Description) });

        await RevokeAllSessions(user.Id);

        await _audit.WriteAsync(
            action: "Users/Delete",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "User",
            resourceId: user.Id,
            result: "Success",
            context: HttpContext);

        return NoContent();
    }

    private async Task<UserDto> MapAsync(ApplicationUser user, IEnumerable<string> roles)
    {
        var roleArray = roles as string[] ?? roles.ToArray();
        var mfaRequiredByRole = roleArray.Contains(AuthRoles.GlobalAdmin, StringComparer.OrdinalIgnoreCase)
            || roleArray.Contains(AuthRoles.TechnicalAdmin, StringComparer.OrdinalIgnoreCase);

        return new UserDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            Status = user.Status,
            IsDeleted = user.IsDeleted,
            LastLoginUtc = user.LastLoginUtc,
            CreatedAtUtc = user.CreatedAtUtc,
            OrganizationScope = user.OrganizationScope,
            Roles = roleArray,
            IsMfaEnabled = await _userManager.GetTwoFactorEnabledAsync(user),
            IsMfaRequiredByRole = mfaRequiredByRole
        };
    }

    private async Task RevokeAllSessions(string userId)
    {
        var sessions = await _db.UserSessions.Where(s => s.UserId == userId && !s.IsRevoked).ToListAsync();
        foreach (var session in sessions)
        {
            session.IsRevoked = true;
            session.RevokedAtUtc = DateTime.UtcNow;
            session.RevokedByUserId = GetCurrentUserId();
        }

        await _db.SaveChangesAsync();
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
