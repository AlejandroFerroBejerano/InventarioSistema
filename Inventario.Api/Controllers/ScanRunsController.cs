using Inventario.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScanRunsController : ControllerBase
{
    private readonly InventarioDbContext _db;

    public ScanRunsController(InventarioDbContext db)
    {
        _db = db;
    }

    // GET /api/scanruns?abonadoMm=MM00000003
    [HttpGet]
    public async Task<ActionResult> Get([FromQuery] string abonadoMm, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(abonadoMm))
            return BadRequest("abonadoMm is required");

        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == abonadoMm.Trim())
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (!installationId.HasValue)
            return Ok(Array.Empty<object>());

        var items = await _db.ScanRuns
            .AsNoTracking()
            .Where(r => r.InstallationId == installationId.Value)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => new
            {
                r.Id,
                r.NetworkId,
                r.NetworkCidr,
                r.StartedAt,
                r.FinishedAt,
                r.TotalHosts,
                r.AuthenticatedCount,
                r.IdentifiedCount,
                r.NoPortsCount
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // GET /api/scanruns/{id}/hosts
    [HttpGet("{id:int}/hosts")]
    public async Task<ActionResult<List<ScanHostResultDto>>> GetHosts(int id, CancellationToken ct)
    {
        // Verificar que el ScanRun existe
        var exists = await _db.ScanRuns
            .AsNoTracking()
            .AnyAsync(r => r.Id == id, ct);

        if (!exists)
            return NotFound();

        var items = await _db.ScanHostResults
            .AsNoTracking()
            .Where(h => h.ScanRunId == id)
            .OrderBy(h => h.IpAddress)
            .Select(h => new ScanHostResultDto
            {
                IpAddress = h.IpAddress,
                Status = h.Status,
                OpenPortsJson = h.OpenPortsJson,
                Manufacturer = h.Manufacturer,
                Model = h.Model,
                Firmware = h.Firmware,
                SerialNumber = h.SerialNumber,
                Protocol = h.Protocol,
                WebPort = h.WebPort,
                SdkPort = h.SdkPort,
                CredentialId = h.CredentialId,
                ErrorMessage = h.ErrorMessage
            })
            .ToListAsync(ct);

        // Parse OpenPortsJson -> List<int> (seguro)
        foreach (var it in items)
            it.OpenPorts = TryParsePorts(it.OpenPortsJson);

        return Ok(items);
    }

    public class ScanHostResultDto
    {
        public string IpAddress { get; set; } = default!;
        public string Status { get; set; } = default!;

        // crudo en DB
        public string OpenPortsJson { get; set; } = "[]";

        // parseado para UI
        public List<int> OpenPorts { get; set; } = new();

        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? Firmware { get; set; }
        public string? SerialNumber { get; set; }
        public string? Protocol { get; set; }

        public int? WebPort { get; set; }
        public int? SdkPort { get; set; }

        public int? CredentialId { get; set; }

        public string? ErrorMessage { get; set; }
    }

    private static List<int> TryParsePorts(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<int>();
        try
        {
            var list = JsonSerializer.Deserialize<List<int>>(json);
            return list ?? new List<int>();
        }
        catch
        {
            return new List<int>();
        }
    }
}