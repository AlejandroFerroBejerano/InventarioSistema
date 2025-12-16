namespace Inventario.Api.Models;

public class CredentialListItemDto
{
    public int CredentialId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Label { get; set; }
    public int Priority { get; set; }
    public string Scope { get; set; } = "General";
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
