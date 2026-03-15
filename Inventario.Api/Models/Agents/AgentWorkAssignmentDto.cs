using System.Text.Json.Serialization;

namespace Inventario.Api.Models.Agents;

public class AgentWorkAssignmentDto
{
    public int JobId { get; set; }
    public string JobType { get; set; } = "NetworkScan";
    public int? NetworkId { get; set; }
    public string TargetNetworkCidr { get; set; } = string.Empty;
    public int Priority { get; set; }
    public string JobPayloadJson { get; set; } = "{}";

    [JsonIgnore]
    public AgentScanJobPayload? Payload { get; set; }
}
