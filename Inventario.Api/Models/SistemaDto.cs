namespace Inventario.Api.Models;

public class SistemaDto
{
    public string AbonadoMm { get; set; } = string.Empty;

    public List<string> Productos { get; set; } = new();

    public string Modelo { get; set; } = string.Empty;
    public string Fabricante { get; set; } = string.Empty;

    public string SerialNumber { get; set; } = string.Empty;
    public string Firmware { get; set; } = string.Empty;

    public string DireccionMac { get; set; } = string.Empty;
    public string DireccionIp { get; set; } = string.Empty;
    public string MascaraRed { get; set; } = string.Empty;

    public int? PuertoSdk { get; set; }
    public int? PuertoWeb { get; set; }

    public string Usuario { get; set; } = string.Empty;
    public string Contrasena { get; set; } = string.Empty;

    public List<DispositivoDto> Dispositivos { get; set; } = new();
}
