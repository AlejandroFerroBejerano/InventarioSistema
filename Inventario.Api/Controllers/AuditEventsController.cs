using Inventario.Api.Data;
using Inventario.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ViewAudit)]
public class AuditEventsController : ControllerBase
{
    private readonly InventarioDbContext _db;

    public AuditEventsController(InventarioDbContext db)
    {
        _db = db;
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

        var query = _db.AuditEvents.AsNoTracking().AsQueryable();

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

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string? actorId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var query = _db.AuditEvents.AsNoTracking().AsQueryable();

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
        var query = _db.AuditEvents.AsNoTracking().AsQueryable();

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

        var rows = await query.OrderByDescending(x => x.TimestampUtc).ToListAsync();
        var content = System.Text.Json.JsonSerializer.Serialize(rows);

        return File(
            Encoding.UTF8.GetBytes(content),
            "application/json; charset=utf-8",
            $"audit-events-{DateTime.UtcNow:yyyyMMdd_HHmmss}.json");
    }

    private static string Escape(string? value)
    {
        value ??= "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";

        return value;
    }
}
