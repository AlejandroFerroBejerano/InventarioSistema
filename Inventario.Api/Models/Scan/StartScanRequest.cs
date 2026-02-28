using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Scan;

public class StartScanRequest
{
    [Required]
    public string AbonadoMm { get; set; } = string.Empty;

    [Required]
    public string NetworkCidr { get; set; } = string.Empty;

    public List<string>? Protocols { get; set; } // e.g. ["AxisVapix","Onvif","Hikvision","Dahua"]

    // Si no lo envías, usaremos una lista por defecto
    public List<int>? Ports { get; set; }

    // Timeout por intento TCP (ms)
    public int ConnectTimeoutMs { get; set; } = 4200;

    // Máximo de conexiones en paralelo (para no saturar)
    public int MaxConcurrency { get; set; } = 10;

    // Activar SSDP discovery
    public bool UseSsdp { get; set; } = true;

    // Duración de escucha SSDP (ms)
    public int SsdpListenMs { get; set; } = 4200;

    public string? Scope { get; set; }

    public string? ApplyMode { get; set; } // "LastWins" | "NoDegrade" | "Review"

}
