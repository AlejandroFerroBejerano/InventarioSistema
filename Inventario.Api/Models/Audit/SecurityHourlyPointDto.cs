namespace Inventario.Api.Models.Audit;

public class SecurityHourlyPointDto
{
    public DateTime BucketUtc { get; set; }
    public int FailedLogins { get; set; }
}

