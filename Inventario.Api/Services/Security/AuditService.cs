using System.Text.Json;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Microsoft.AspNetCore.Http;

namespace Inventario.Api.Services.Security;

public interface IAuditService
{
    Task WriteAsync(
        string action,
        string actorType = "User",
        string? actorId = null,
        string? resourceType = null,
        string? resourceId = null,
        string? result = "Success",
        HttpContext? context = null,
        object? details = null);
}

public class AuditService : IAuditService
{
    private readonly InventarioDbContext _db;

    public AuditService(InventarioDbContext db)
    {
        _db = db;
    }

    public async Task WriteAsync(
        string action,
        string actorType,
        string? actorId,
        string? resourceType,
        string? resourceId,
        string? result,
        HttpContext? context,
        object? details)
    {
        var ip = context?.Connection.RemoteIpAddress?.ToString();
        var correlationId = context?.TraceIdentifier;
        var detailsJson = details is null ? null : JsonSerializer.Serialize(details);

        _db.AuditEvents.Add(new AuditEvent
        {
            TimestampUtc = DateTime.UtcNow,
            ActorType = actorType,
            ActorId = actorId,
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Result = result,
            IpAddress = ip,
            CorrelationId = correlationId,
            DetailsJson = detailsJson
        });

        await _db.SaveChangesAsync();
    }
}
