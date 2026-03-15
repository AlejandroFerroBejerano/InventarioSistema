using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class RemoteAgent
{
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string AgentCode { get; set; } = string.Empty;

    public int? InstallationId { get; set; }
    public Installation? Installation { get; set; }

    [MaxLength(80)]
    public string? FriendlyName { get; set; }

    [MaxLength(80)]
    public string? HostName { get; set; }

    [MaxLength(120)]
    public string? Os { get; set; }

    [MaxLength(30)]
    public string? Architecture { get; set; }

    [MaxLength(40)]
    public string? CurrentVersion { get; set; }

    [Required, MaxLength(30)]
    public string Status { get; set; } = "PendingEnrollment";

    public bool IsOnline { get; set; }
    public bool IsRevoked { get; set; }

    [Required, MaxLength(128)]
    public string EnrollmentTokenHash { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? SessionTokenHash { get; set; }

    public DateTime? EnrollmentExpiresAt { get; set; }
    public DateTime? LastConnectedAt { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public DateTime? LastDisconnectedAt { get; set; }

    [MaxLength(64)]
    public string? LastIpAddress { get; set; }

    [MaxLength(120)]
    public string? LastConnectionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SystemAsset> SourceAssets { get; set; } = new List<SystemAsset>();
    public ICollection<AgentJob> Jobs { get; set; } = new List<AgentJob>();
}
