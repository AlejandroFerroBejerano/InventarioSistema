using System;

namespace Inventario.Api.Models.Agents;

public class AgentDto
{
    public int Id { get; set; }
    public string AgentCode { get; set; } = string.Empty;
    public string? FriendlyName { get; set; }
    public int? InstallationId { get; set; }
    public string? InstallationAbonadoMm { get; set; }
    public string? HostName { get; set; }
    public string? Os { get; set; }
    public string? Architecture { get; set; }
    public string? CurrentVersion { get; set; }
    public string Status { get; set; } = "PendingEnrollment";
    public bool IsOnline { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public string? LastIpAddress { get; set; }
}
