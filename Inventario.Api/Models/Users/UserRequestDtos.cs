using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Users;

public class CreateUserRequest
{
    [Required]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    public string? UserName { get; set; }
    public string? DisplayName { get; set; }
    public string? Role { get; set; }
    public string Status { get; set; } = "Active";
    public string? OrganizationScope { get; set; }
}

public class UpdateUserRequest
{
    public string? UserName { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? Status { get; set; }
    public string? Role { get; set; }
    public string? OrganizationScope { get; set; }
}

public class SetUserStatusRequest
{
    [Required]
    public string Status { get; set; } = "Active";
}
