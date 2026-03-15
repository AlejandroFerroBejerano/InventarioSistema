using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class AgentJob
{
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string JobType { get; set; } = "NetworkScan";

    public int? InstallationId { get; set; }
    public Installation? Installation { get; set; }

    public int? NetworkId { get; set; }
    public Network? Network { get; set; }

    [Required, MaxLength(60)]
    public string TargetNetworkCidr { get; set; } = string.Empty;

    [Required, MaxLength(6000)]
    public string JobPayloadJson { get; set; } = "{}";

    [Required, MaxLength(30)]
    public string Status { get; set; } = "Queued";

    public int Priority { get; set; }

    public int ProgressPercent { get; set; }
    public string? LastProgressMessage { get; set; }

    public string? ErrorMessage { get; set; }

    public int? ScanRunId { get; set; }
    public ScanRun? ScanRun { get; set; }

    public int? AssignedAgentId { get; set; }
    public RemoteAgent? AssignedAgent { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
