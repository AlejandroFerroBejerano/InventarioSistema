using Inventario.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
}