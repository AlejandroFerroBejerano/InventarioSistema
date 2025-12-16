using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models;

public class UpdateCredentialRequest
{
    [Range(1, 999)]
    public int? Priority { get; set; }

    [MaxLength(30)]
    public string? Scope { get; set; }

    public bool? IsActive { get; set; }

    [MaxLength(100)]
    public string? Label { get; set; }
}
