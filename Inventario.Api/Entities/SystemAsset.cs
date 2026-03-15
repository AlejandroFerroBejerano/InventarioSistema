using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class SystemAsset
{
    public int Id { get; set; }

    public int InstallationId { get; set; }
    public Installation? Installation { get; set; }

    [Required, MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Category { get; set; } = "Unknown";

    [MaxLength(50)]
    public string? Manufacturer { get; set; }

    [MaxLength(100)]
    public string? Model { get; set; }

    [MaxLength(50)]
    public string? Firmware { get; set; }

    [MaxLength(80)]
    public string? SerialNumber { get; set; }

    [Required]
    public string OpenPortsJson { get; set; } = "[]";

    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }

    [MaxLength(30)]
    public string? Protocol { get; set; }

    [MaxLength(20)]
    public string? Status { get; set; }

    public int? PreferredCredentialId { get; set; }
    public Credential? PreferredCredential { get; set; }

    public int? SourceAgentId { get; set; }
    public RemoteAgent? SourceAgent { get; set; }

    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
