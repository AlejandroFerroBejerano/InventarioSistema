namespace Inventario.Api.Entities;

public class ScanHostResult
{
    public int Id { get; set; }

    public int ScanRunId { get; set; }
    public ScanRun ScanRun { get; set; } = default!;

    public string IpAddress { get; set; } = default!;
    public string Status { get; set; } = default!;

    public string OpenPortsJson { get; set; } = "[]";

    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Firmware { get; set; }
    public string? SerialNumber { get; set; }
    public string? Protocol { get; set; }

    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }

    public int? CredentialId { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}