using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Audit;
using Inventario.Api.Security;
using Inventario.Api.Services.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ViewAudit)]
public class AuditEventsController : ControllerBase
{
    private readonly InventarioDbContext _db;
    private readonly IAuditService _audit;

    public AuditEventsController(InventarioDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? actorId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 200)
    {
        var safeTake = Math.Clamp(take, 1, 500);
        var safeSkip = Math.Max(0, skip);

        var query = ApplyFilters(_db.AuditEvents.AsNoTracking(), actorId, action, resourceType, fromUtc, toUtc);

        var total = await query.LongCountAsync();
        var items = await query.OrderByDescending(x => x.TimestampUtc)
            .Skip(safeSkip)
            .Take(safeTake)
            .ToListAsync();

        return Ok(new
        {
            total,
            skip = safeSkip,
            take = safeTake,
            items
        });
    }

    [HttpGet("security/summary")]
    public async Task<ActionResult<SecuritySummaryDto>> GetSecuritySummary(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var to = (toUtc ?? DateTime.UtcNow).ToUniversalTime();
        var from = (fromUtc ?? to.AddHours(-24)).ToUniversalTime();
        if (from > to)
            return BadRequest(new { message = "fromUtc must be <= toUtc." });

        var query = _db.AuditEvents.AsNoTracking()
            .Where(x => x.TimestampUtc >= from && x.TimestampUtc <= to);

        var totalEvents = await query.LongCountAsync();
        var successfulLogins = await query.CountAsync(x =>
            (x.Action == "Auth/Login" || x.Action == "Auth/MfaVerify") && x.Result == "Success");
        var failedLogins = await query.CountAsync(x => x.Action == "Auth/Login" && x.Result == "Failed");
        var mfaEnabledEvents = await query.CountAsync(x => x.Action == "Auth/MfaEnabled");
        var mfaDisabledEvents = await query.CountAsync(x => x.Action == "Auth/MfaDisabled");
        var roleChanges = await query.CountAsync(x => x.Action == "Users/ChangeRole");
        var dataExports = await query.CountAsync(x => x.Action == "Audit/ExportCsv" || x.Action == "Audit/ExportJson");

        var topActions = await query
            .GroupBy(x => x.Action)
            .Select(g => new SecurityActionCountDto
            {
                Action = g.Key,
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count)
            .Take(8)
            .ToListAsync();

        var failedLoginRows = await query
            .Where(x => x.Action == "Auth/Login" && x.Result == "Failed")
            .Select(x => new { x.TimestampUtc, x.DetailsJson })
            .ToListAsync();

        var lockedOutAttempts = failedLoginRows.Count(x =>
            string.Equals(TryReadDetailValue(x.DetailsJson, "reason"), "LockedOut", StringComparison.OrdinalIgnoreCase));

        var failedLoginsByHour = failedLoginRows
            .GroupBy(x => new DateTime(x.TimestampUtc.Year, x.TimestampUtc.Month, x.TimestampUtc.Day, x.TimestampUtc.Hour, 0, 0, DateTimeKind.Utc))
            .OrderBy(x => x.Key)
            .Select(x => new SecurityHourlyPointDto
            {
                BucketUtc = x.Key,
                FailedLogins = x.Count()
            })
            .ToList();

        var summary = new SecuritySummaryDto
        {
            FromUtc = from,
            ToUtc = to,
            TotalEvents = totalEvents,
            SuccessfulLogins = successfulLogins,
            FailedLogins = failedLogins,
            LockedOutAttempts = lockedOutAttempts,
            MfaEnabledEvents = mfaEnabledEvents,
            MfaDisabledEvents = mfaDisabledEvents,
            RoleChanges = roleChanges,
            DataExports = dataExports,
            TopActions = topActions,
            FailedLoginsByHour = failedLoginsByHour
        };

        return Ok(summary);
    }

    [HttpGet("security/alerts")]
    public async Task<ActionResult<List<SecurityAlertDto>>> GetSecurityAlerts(
        [FromQuery] int hours = 24,
        [FromQuery] int take = 100)
    {
        var safeHours = Math.Clamp(hours, 1, 168);
        var safeTake = Math.Clamp(take, 1, 500);
        var from = DateTime.UtcNow.AddHours(-safeHours);

        var rows = await _db.AuditEvents.AsNoTracking()
            .Where(x => x.TimestampUtc >= from)
            .OrderByDescending(x => x.TimestampUtc)
            .ToListAsync();

        var alerts = new List<SecurityAlertDto>();

        var failedLogins = rows
            .Where(x => x.Action == "Auth/Login" && x.Result == "Failed")
            .ToList();

        foreach (var group in failedLogins.Where(x => !string.IsNullOrWhiteSpace(x.IpAddress)).GroupBy(x => x.IpAddress!))
        {
            if (group.Count() < 5)
                continue;

            var first = group.Min(x => x.TimestampUtc);
            var last = group.Max(x => x.TimestampUtc);
            if ((last - first) > TimeSpan.FromMinutes(15))
                continue;

            alerts.Add(new SecurityAlertDto
            {
                Id = $"failed-ip-{group.Key}-{last.Ticks}",
                DetectedAtUtc = last,
                Severity = "High",
                Category = "BruteForce",
                Title = "Repeated failed login attempts from same IP",
                Description = $"{group.Count()} failed logins in <= 15 minutes.",
                IpAddress = group.Key,
                Action = "Auth/Login",
                Count = group.Count()
            });
        }

        foreach (var group in failedLogins.Where(x => !string.IsNullOrWhiteSpace(x.ResourceId)).GroupBy(x => x.ResourceId!))
        {
            if (group.Count() < 5)
                continue;

            var first = group.Min(x => x.TimestampUtc);
            var last = group.Max(x => x.TimestampUtc);
            if ((last - first) > TimeSpan.FromMinutes(15))
                continue;

            alerts.Add(new SecurityAlertDto
            {
                Id = $"failed-user-{group.Key}-{last.Ticks}",
                DetectedAtUtc = last,
                Severity = "Medium",
                Category = "CredentialAttack",
                Title = "Repeated failed login attempts for account",
                Description = $"{group.Count()} failed logins in <= 15 minutes.",
                ResourceId = group.Key,
                Action = "Auth/Login",
                Count = group.Count()
            });
        }

        foreach (var row in failedLogins)
        {
            if (!string.Equals(TryReadDetailValue(row.DetailsJson, "reason"), "LockedOut", StringComparison.OrdinalIgnoreCase))
                continue;

            alerts.Add(new SecurityAlertDto
            {
                Id = $"locked-{row.Id}",
                DetectedAtUtc = row.TimestampUtc,
                Severity = "High",
                Category = "AccountLockout",
                Title = "Account lockout detected",
                Description = "Login was attempted while account was locked.",
                ResourceId = row.ResourceId,
                IpAddress = row.IpAddress,
                Action = row.Action,
                Count = 1
            });
        }

        foreach (var row in rows.Where(x => x.Action == "Auth/MfaDisabled"))
        {
            alerts.Add(new SecurityAlertDto
            {
                Id = $"mfa-disabled-{row.Id}",
                DetectedAtUtc = row.TimestampUtc,
                Severity = "High",
                Category = "MfaChange",
                Title = "MFA disabled",
                Description = "A user disabled MFA.",
                ActorId = row.ActorId,
                ResourceId = row.ResourceId,
                Action = row.Action,
                Count = 1
            });
        }

        foreach (var row in rows.Where(x => x.Action == "Users/ChangeRole"))
        {
            alerts.Add(new SecurityAlertDto
            {
                Id = $"role-change-{row.Id}",
                DetectedAtUtc = row.TimestampUtc,
                Severity = "Medium",
                Category = "PrivilegeChange",
                Title = "Role change detected",
                Description = "A user role was changed.",
                ActorId = row.ActorId,
                ResourceId = row.ResourceId,
                Action = row.Action,
                Count = 1
            });
        }

        var exports = rows.Where(x => x.Action == "Audit/ExportCsv" || x.Action == "Audit/ExportJson").ToList();
        foreach (var group in exports.Where(x => !string.IsNullOrWhiteSpace(x.ActorId)).GroupBy(x => x.ActorId!))
        {
            if (group.Count() < 3)
                continue;

            var first = group.Min(x => x.TimestampUtc);
            var last = group.Max(x => x.TimestampUtc);
            if ((last - first) > TimeSpan.FromHours(1))
                continue;

            alerts.Add(new SecurityAlertDto
            {
                Id = $"export-spike-{group.Key}-{last.Ticks}",
                DetectedAtUtc = last,
                Severity = "Medium",
                Category = "DataExfiltration",
                Title = "High export activity detected",
                Description = $"{group.Count()} exports in <= 1 hour.",
                ActorId = group.Key,
                Action = "Audit/Export*",
                Count = group.Count()
            });
        }

        return Ok(alerts
            .OrderByDescending(x => x.DetectedAtUtc)
            .Take(safeTake)
            .ToList());
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string? actorId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var query = ApplyFilters(_db.AuditEvents.AsNoTracking(), actorId, action, resourceType, fromUtc, toUtc);

        var rows = await query.OrderByDescending(x => x.TimestampUtc).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("Id,TimestampUtc,ActorType,ActorId,Action,ResourceType,ResourceId,Result,IpAddress,CorrelationId,DetailsJson");
        foreach (var e in rows)
        {
            sb.AppendLine(string.Join(",",
                Escape(e.Id.ToString()),
                Escape(e.TimestampUtc.ToString("O")),
                Escape(e.ActorType),
                Escape(e.ActorId),
                Escape(e.Action),
                Escape(e.ResourceType),
                Escape(e.ResourceId),
                Escape(e.Result),
                Escape(e.IpAddress),
                Escape(e.CorrelationId),
                Escape(e.DetailsJson)));
        }

        await _audit.WriteAsync(
            action: "Audit/ExportCsv",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "AuditEvent",
            resourceId: null,
            result: "Success",
            context: HttpContext,
            details: new { actorId, action, resourceType, fromUtc, toUtc, count = rows.Count });

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv; charset=utf-8", $"audit-events-{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
    }

    [HttpGet("export/json")]
    public async Task<IActionResult> ExportJson(
        [FromQuery] string? actorId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var query = ApplyFilters(_db.AuditEvents.AsNoTracking(), actorId, action, resourceType, fromUtc, toUtc);

        var rows = await query.OrderByDescending(x => x.TimestampUtc).ToListAsync();
        var content = JsonSerializer.Serialize(rows);

        await _audit.WriteAsync(
            action: "Audit/ExportJson",
            actorType: "User",
            actorId: GetCurrentUserId(),
            resourceType: "AuditEvent",
            resourceId: null,
            result: "Success",
            context: HttpContext,
            details: new { actorId, action, resourceType, fromUtc, toUtc, count = rows.Count });

        return File(
            Encoding.UTF8.GetBytes(content),
            "application/json; charset=utf-8",
            $"audit-events-{DateTime.UtcNow:yyyyMMdd_HHmmss}.json");
    }

    private static IQueryable<AuditEvent> ApplyFilters(
        IQueryable<AuditEvent> query,
        string? actorId,
        string? action,
        string? resourceType,
        DateTime? fromUtc,
        DateTime? toUtc)
    {
        if (!string.IsNullOrWhiteSpace(actorId))
            query = query.Where(x => x.ActorId == actorId);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(x => x.Action == action);

        if (!string.IsNullOrWhiteSpace(resourceType))
            query = query.Where(x => x.ResourceType == resourceType);

        if (fromUtc.HasValue)
            query = query.Where(x => x.TimestampUtc >= fromUtc.Value);

        if (toUtc.HasValue)
            query = query.Where(x => x.TimestampUtc <= toUtc.Value);

        return query;
    }

    private static string? TryReadDetailValue(string? detailsJson, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(detailsJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(detailsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            if (doc.RootElement.TryGetProperty(propertyName, out var property))
                return property.GetString();
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static string Escape(string? value)
    {
        value ??= "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";

        return value;
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
