namespace Inventario.Api.Entities;

public class ScanRun
{
    public int Id { get; set; }

    public int InstallationId { get; set; }
    public Installation Installation { get; set; } = default!;

    public int? NetworkId { get; set; }
    public Network? Network { get; set; }

    public string NetworkCidr { get; set; } = default!;

    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    public int TotalHosts { get; set; }
    public int AuthenticatedCount { get; set; }
    public int IdentifiedCount { get; set; }
    public int NoPortsCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ScanHostResult> HostResults { get; set; } = new List<ScanHostResult>();
}