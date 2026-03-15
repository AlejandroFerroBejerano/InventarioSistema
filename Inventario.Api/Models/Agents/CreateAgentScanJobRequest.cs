using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Agents;

public class CreateAgentScanJobRequest
{
    [Required]
    public string JobType { get; set; } = "NetworkScan";

    public int? InstallationId { get; set; }
    public string? AbonadoMm { get; set; }

    public int? NetworkId { get; set; }
    public string NetworkCidr { get; set; } = string.Empty;

    public List<int>? Ports { get; set; }
    public List<string>? Protocols { get; set; }
    public int ConnectTimeoutMs { get; set; } = 4200;
    public int MaxConcurrency { get; set; } = 10;
    public bool UseSsdp { get; set; } = true;
    public int SsdpListenMs { get; set; } = 4200;
    public string? Scope { get; set; }
    public string? ApplyMode { get; set; }
    public int Priority { get; set; }
}
