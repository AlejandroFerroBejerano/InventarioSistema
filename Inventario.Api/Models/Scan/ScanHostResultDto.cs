namespace Inventario.Api.Models.Scan;

public class ScanHostResultDto
{
    public string Ip { get; set; } = string.Empty;

    // Puertos TCP abiertos detectados
    public List<int> OpenPorts { get; set; } = new();

    // Pistas de descubrimiento por SSDP (si respondió)
    public SsdpInfoDto? Ssdp { get; set; }

    public string Status { get; set; } = "Unknown"; // Found | NoPorts | SsdpOnly | Unknown

    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Firmware { get; set; }

    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }

    public int? CredentialId { get; set; }
    public string? CredentialUsername { get; set; }
    public string? SerialNumber { get; set; }
    
    //Protocol te ayuda a saber con qué “driver” ha funcionado
    public string? Protocol { get; set; }
}
