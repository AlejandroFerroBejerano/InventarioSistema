using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class SystemAsset
{
    public int Id { get; set; }

    // Relación con la instalación (AbonadoMM)
    public int InstallationId { get; set; }
    public Installation? Installation { get; set; }

    // IP del activo en red
    [Required, MaxLength(45)]
    public string IpAddress { get; set; } = string.Empty;

    // Clasificación del activo: Recorder / Camera / Server / Other / Unknown...
    [Required, MaxLength(20)]
    public string Category { get; set; } = "Unknown";

    // Identificación (cuando la tengamos)
    [MaxLength(50)]
    public string? Manufacturer { get; set; }

    [MaxLength(100)]
    public string? Model { get; set; }

    [MaxLength(50)]
    public string? Firmware { get; set; }

    [MaxLength(80)]
    public string? SerialNumber { get; set; }

    // Puertos detectados
    // Guardamos como JSON para tener lista sin tabla auxiliar (MVP).
    [Required]
    public string OpenPortsJson { get; set; } = "[]";

    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }

    // Info del último escaneo
    [MaxLength(30)]
    public string? Protocol { get; set; }

    [MaxLength(20)]
    public string? Status { get; set; } // Identified / Authenticated / NoPorts / etc.

    // Credencial preferida (si alguna funcionó)
    public int? PreferredCredentialId { get; set; }
    public Credential? PreferredCredential { get; set; }

    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
