namespace Inventario.Api.Models;

public class DispositivoDto
{
    public string DispId { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;

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
}
