using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models;

public class CreateCredentialRequest
{
    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Password { get; set; } = string.Empty;

    [Range(1, 999)]
    public int Priority { get; set; } = 1;

    [MaxLength(30)]
    public string Scope { get; set; } = "General";

    [MaxLength(100)]
    public string? Label { get; set; }

    public bool IsActive { get; set; } = true;
}
