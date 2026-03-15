namespace Inventario.Api.Models.Agents;

public class AgentHeartbeatDto
{
    public string? AgentName { get; set; }
    public string? HostName { get; set; }
    public string? Version { get; set; }
    public string? Os { get; set; }
    public string? Architecture { get; set; }
    public string? Status { get; set; }
    public string? LocalIp { get; set; }
}
