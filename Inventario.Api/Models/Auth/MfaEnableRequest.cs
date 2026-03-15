using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Auth;

public class MfaEnableRequest
{
    public string? UserId { get; set; }

    [Required]
    [StringLength(16, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;
}

