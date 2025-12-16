using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Scan;

public class StartScanRequest
{
    [Required]
    public string AbonadoMm { get; set; } = string.Empty;

    [Required]
    public string NetworkCidr { get; set; } = string.Empty;

    // Si no lo envías, usaremos una lista por defecto
    public List<int>? Ports { get; set; }

    // Timeout por intento TCP (ms)
    public int ConnectTimeoutMs { get; set; } = 400;

    // Máximo de conexiones en paralelo (para no saturar)
    public int MaxConcurrency { get; set; } = 200;

    // Activar SSDP discovery
    public bool UseSsdp { get; set; } = true;

    // Duración de escucha SSDP (ms)
    public int SsdpListenMs { get; set; } = 1200;
}
