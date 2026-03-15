using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace Inventario.Api.Entities;

public class ApplicationUser : IdentityUser
{
    [MaxLength(80)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Status { get; set; } = "Active";

    public bool IsDeleted { get; set; }

    public DateTime? LastLoginUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string? OrganizationScope { get; set; }

    public bool PasswordMustChange { get; set; }

    public DateTime? DeletedAtUtc { get; set; }
}
