using System.Collections.Generic;

namespace Inventario.Api.Models.Agents;

public class AgentScanResultHostDto
{
    public string IpAddress { get; set; } = string.Empty;
    public string Status { get; set; } = "Unknown";
    public List<int> OpenPorts { get; set; } = new();
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Firmware { get; set; }
    public string? SerialNumber { get; set; }
    public string? Protocol { get; set; }
    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }
    public int? CredentialId { get; set; }
    public string? CredentialUsername { get; set; }
    public string? Category { get; set; }
}
