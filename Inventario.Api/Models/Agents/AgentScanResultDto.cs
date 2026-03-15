using System.Collections.Generic;

namespace Inventario.Api.Models.Agents;

public class AgentScanResultDto
{
    public int JobId { get; set; }
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
    public string? ExecutionSummary { get; set; }
    public List<AgentScanResultHostDto> Hosts { get; set; } = new();
}
