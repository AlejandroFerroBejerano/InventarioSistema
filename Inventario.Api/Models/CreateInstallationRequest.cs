using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models;

public class CreateInstallationRequest
{
    [Required]
    [MaxLength(10)]
    public string AbonadoMm { get; set; } = string.Empty;

    [Required]
    public string Nombre { get; set; } = string.Empty;
}
