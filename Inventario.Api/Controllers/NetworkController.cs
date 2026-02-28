using Inventario.Api.Data;
using Inventario.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NetworksController : ControllerBase
{
    private readonly InventarioDbContext _db;

    public NetworksController(InventarioDbContext db)
    {
        _db = db;
    }

    // GET /api/networks?abonadoMm=MM00000001
    [HttpGet]
    public async Task<ActionResult<List<NetworkDto>>> Get([FromQuery] string abonadoMm, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(abonadoMm))
            return BadRequest("abonadoMm is required");

        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == abonadoMm.Trim())
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (!installationId.HasValue)
            return Ok(new List<NetworkDto>());

        var items = await _db.Networks
            .AsNoTracking()
            .Where(n => n.InstallationId == installationId.Value)
            .OrderBy(n => n.Name)
            .Select(n => new NetworkDto
            {
                Id = n.Id,
                Name = n.Name,
                Cidr = n.Cidr,
                IsActive = n.IsActive
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // POST /api/networks
    [HttpPost]
    public async Task<ActionResult<NetworkDto>> Create([FromBody] CreateNetworkRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.AbonadoMm))
            return BadRequest("abonadoMm is required");
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("name is required");
        if (string.IsNullOrWhiteSpace(req.Cidr))
            return BadRequest("cidr is required");

        var installation = await _db.Installations
            .FirstOrDefaultAsync(x => x.AbonadoMm == req.AbonadoMm.Trim(), ct);

        if (installation is null)
            return BadRequest("Installation not found for abonadoMm");

        var now = DateTime.UtcNow;

        var entity = new Network
        {
            InstallationId = installation.Id,
            Name = req.Name.Trim(),
            Cidr = req.Cidr.Trim(),
            IsActive = req.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Networks.Add(entity);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // por índices únicos (Name/Cidr por instalación)
            return Conflict("Network with same Name or Cidr already exists for this abonadoMm");
        }

        var dto = new NetworkDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Cidr = entity.Cidr,
            IsActive = entity.IsActive
        };

        return Ok(dto);
    }

    // PUT /api/networks/{id}
    [HttpPut("{id:int}")]
    public async Task<ActionResult<NetworkDto>> Update(int id, [FromBody] UpdateNetworkRequest req, CancellationToken ct)
    {
        var entity = await _db.Networks.FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null)
            return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Name))
            entity.Name = req.Name.Trim();

        if (!string.IsNullOrWhiteSpace(req.Cidr))
            entity.Cidr = req.Cidr.Trim();

        if (req.IsActive.HasValue)
            entity.IsActive = req.IsActive.Value;

        entity.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Conflict("Network with same Name or Cidr already exists for this installation");
        }

        return Ok(new NetworkDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Cidr = entity.Cidr,
            IsActive = entity.IsActive
        });
    }

    // DELETE /api/networks/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var entity = await _db.Networks.FirstOrDefaultAsync(n => n.Id == id, ct);
        if (entity is null)
            return NotFound();

        _db.Networks.Remove(entity);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}

public class NetworkDto
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string Cidr { get; set; } = default!;
    public bool IsActive { get; set; }
}

public class CreateNetworkRequest
{
    public string AbonadoMm { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Cidr { get; set; } = default!;
    public bool IsActive { get; set; } = true;
}

public class UpdateNetworkRequest
{
    public string? Name { get; set; }
    public string? Cidr { get; set; }
    public bool? IsActive { get; set; }
}