using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class InstallationCredential
{
    public int InstallationId { get; set; }
    public Installation? Installation { get; set; }

    public int CredentialId { get; set; }
    public Credential? Credential { get; set; }

    // Orden de prueba (1 = primero)
    [Range(1, 999)]
    public int Priority { get; set; } = 1;

    // Opcional: limitar uso por fabricante/ámbito: "Axis", "Hikvision", "Dahua", "General"
    [MaxLength(30)]
    public string Scope { get; set; } = "General";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
