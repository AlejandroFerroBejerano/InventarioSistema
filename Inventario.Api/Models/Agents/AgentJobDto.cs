namespace Inventario.Api.Models.Agents;

public class AgentJobDto
{
    public int Id { get; set; }
    public string JobType { get; set; } = "NetworkScan";
    public string Status { get; set; } = "Queued";
    public int? InstallationId { get; set; }
    public string? InstallationAbonadoMm { get; set; }
    public int? NetworkId { get; set; }
    public string TargetNetworkCidr { get; set; } = string.Empty;
    public int? AssignedAgentId { get; set; }
    public int Priority { get; set; }
    public int ProgressPercent { get; set; }
    public string? LastProgressMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public int? ScanRunId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
