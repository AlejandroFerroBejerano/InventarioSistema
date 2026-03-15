using System.ComponentModel.DataAnnotations;

namespace Inventario.Api.Models.Auth;

public class MfaVerifyRequest
{
    [Required]
    public string MfaChallengeToken { get; set; } = string.Empty;

    [Required]
    [StringLength(16, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;

    public bool UseRecoveryCode { get; set; }
}

