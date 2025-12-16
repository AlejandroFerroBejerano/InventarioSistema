using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InstallationsController : ControllerBase
{
    private readonly InventarioDbContext _db;

    public InstallationsController(InventarioDbContext db)
    {
        _db = db;
    }

    // GET /api/installations
    [HttpGet]
    public async Task<ActionResult<List<Installation>>> GetAll()
    {
        var items = await _db.Installations
            .OrderBy(x => x.AbonadoMm)
            .ToListAsync();

        return Ok(items);
    }

    // POST /api/installations
    [HttpPost]
    public async Task<ActionResult<Installation>> Create([FromBody] CreateInstallationRequest request)
    {
        // Normalizamos
        var abonado = request.AbonadoMm.Trim();

        // Validación: único
        var exists = await _db.Installations.AnyAsync(x => x.AbonadoMm == abonado);
        if (exists)
            return Conflict(new { message = $"Ya existe una instalación con AbonadoMm='{abonado}'." });

        var entity = new Installation
        {
            AbonadoMm = abonado,
            Nombre = request.Nombre.Trim()
        };

        _db.Installations.Add(entity);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, entity);
    }

    // GET /api/installations/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Installation>> GetById([FromRoute] int id)
    {
        var entity = await _db.Installations.FirstOrDefaultAsync(x => x.Id == id);
        if (entity is null) return NotFound();
        return Ok(entity);
    }
}
