using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Entities;

public class Credential
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    // Se guarda CIFRADA (no en claro)
    [Required]
    public string PasswordProtected { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Label { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<InstallationCredential> InstallationCredentials { get; set; } = new();
}
