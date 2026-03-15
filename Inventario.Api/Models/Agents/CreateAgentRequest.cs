namespace Inventario.Api.Models.Agents;

public class CreateAgentRequest
{
    public int? InstallationId { get; set; }
    public string? FriendlyName { get; set; }
    public string? AgentCode { get; set; }
}
