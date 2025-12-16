using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class Installation
{
    public int Id { get; set; }

    [Required]
    [MaxLength(10)]
    public string AbonadoMm { get; set; } = string.Empty;

    [Required]
    public string Nombre { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<InstallationCredential> InstallationCredentials { get; set; } = new();
}
