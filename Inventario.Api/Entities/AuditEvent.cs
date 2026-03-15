namespace Inventario.Api.Entities;

public class AuditEvent
{
    public int Id { get; set; }

    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

    public string ActorType { get; set; } = "User";

    public string? ActorId { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? ResourceType { get; set; }

    public string? ResourceId { get; set; }

    public string? Result { get; set; }

    public string? IpAddress { get; set; }

    public string? CorrelationId { get; set; }

    public string? DetailsJson { get; set; }
}
