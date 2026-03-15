namespace Inventario.Api.Models.Agents;

public class EnrollAgentRequest
{
    public string AgentCode { get; set; } = string.Empty;
    public string EnrollmentToken { get; set; } = string.Empty;

    public string? AgentName { get; set; }
    public string? HostName { get; set; }
    public string? Version { get; set; }
    public string? Os { get; set; }
    public string? Architecture { get; set; }
}
