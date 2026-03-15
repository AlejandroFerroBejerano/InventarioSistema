namespace Inventario.Api.Models.Users;

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public bool IsDeleted { get; set; }
    public DateTime? LastLoginUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public string? OrganizationScope { get; set; }
    public string[] Roles { get; set; } = System.Array.Empty<string>();
}
