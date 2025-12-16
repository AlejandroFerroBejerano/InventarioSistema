namespace Inventario.Api.Models.Scan;

public class ScanResponseDto
{
    public Guid ScanId { get; set; } = Guid.NewGuid();
    public string AbonadoMm { get; set; } = string.Empty;
    public string NetworkCidr { get; set; } = string.Empty;

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime FinishedAt { get; set; }

    public List<ScanHostResultDto> Hosts { get; set; } = new();
}
