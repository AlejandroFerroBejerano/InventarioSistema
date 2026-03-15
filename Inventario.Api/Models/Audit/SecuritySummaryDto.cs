namespace Inventario.Api.Models.Audit;

public class SecuritySummaryDto
{
    public DateTime FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public long TotalEvents { get; set; }
    public int SuccessfulLogins { get; set; }
    public int FailedLogins { get; set; }
    public int LockedOutAttempts { get; set; }
    public int MfaEnabledEvents { get; set; }
    public int MfaDisabledEvents { get; set; }
    public int RoleChanges { get; set; }
    public int DataExports { get; set; }
    public List<SecurityActionCountDto> TopActions { get; set; } = new();
    public List<SecurityHourlyPointDto> FailedLoginsByHour { get; set; } = new();
}

