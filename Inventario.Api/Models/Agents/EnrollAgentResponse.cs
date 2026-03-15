namespace Inventario.Api.Models.Agents;

public class EnrollAgentResponse
{
    public int AgentId { get; set; }
    public string AgentCode { get; set; } = string.Empty;
    public int? InstallationId { get; set; }
    public string SessionToken { get; set; } = string.Empty;
    public string HubUrl { get; set; } = string.Empty;
    public string Instructions { get; set; } = "Connect to Hub with query: ?agentId={id}&agentToken={SessionToken}";
}
