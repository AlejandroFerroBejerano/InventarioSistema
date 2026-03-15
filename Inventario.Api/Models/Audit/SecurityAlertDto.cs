namespace Inventario.Api.Models.Audit;

public class SecurityAlertDto
{
    public string Id { get; set; } = string.Empty;
    public DateTime DetectedAtUtc { get; set; }
    public string Severity { get; set; } = "Info";
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ActorId { get; set; }
    public string? ResourceId { get; set; }
    public string? IpAddress { get; set; }
    public string? Action { get; set; }
    public int Count { get; set; }
}

