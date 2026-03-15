namespace Inventario.Api.Models.Agents;

public class CreateAgentResponse
{
    public int AgentId { get; set; }
    public string AgentCode { get; set; } = string.Empty;
    public string EnrollmentToken { get; set; } = string.Empty;
    public string HubUrl { get; set; } = string.Empty;
    public string Message { get; set; } = "Register this token in the agent installer. Use /api/agents/enroll.";
}
