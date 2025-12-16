namespace Inventario.Api.Models.Scan;

public class ScanHostResultDto
{
    public string Ip { get; set; } = string.Empty;

    // Puertos TCP abiertos detectados
    public List<int> OpenPorts { get; set; } = new();

    // Pistas de descubrimiento por SSDP (si respondió)
    public SsdpInfoDto? Ssdp { get; set; }

    public string Status { get; set; } = "Unknown"; // Found | NoPorts | SsdpOnly | Unknown
}
