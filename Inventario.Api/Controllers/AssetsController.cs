using Inventario.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssetsController : ControllerBase
{
    private readonly InventarioDbContext _db;

    public AssetsController(InventarioDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<SystemAssetListItemDto>>> Get([FromQuery] string abonadoMm, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(abonadoMm))
            return BadRequest("abonadoMm is required");

        var installationId = await _db.Installations
            .AsNoTracking()
            .Where(x => x.AbonadoMm == abonadoMm.Trim())
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (!installationId.HasValue)
            return Ok(new List<SystemAssetListItemDto>());

        var items = await _db.SystemAssets
            .AsNoTracking()
            .Where(x => x.InstallationId == installationId.Value)
            .OrderBy(x => x.IpAddress)
            .Select(x => new SystemAssetListItemDto
            {
                IpAddress = x.IpAddress,
                Category = x.Category,
                Manufacturer = x.Manufacturer,
                Model = x.Model,
                Firmware = x.Firmware,
                SerialNumber = x.SerialNumber,
                Protocol = x.Protocol,
                Status = x.Status,
                WebPort = x.WebPort,
                SdkPort = x.SdkPort,
                PreferredCredentialId = x.PreferredCredentialId,
                LastSeenAt = x.LastSeenAt,
                OpenPorts = x.OpenPortsJson
            })
            .ToListAsync(ct);

        // Parse OpenPortsJson -> List<int> (sin romper si hay JSON malo)
        foreach (var it in items)
        {
            it.OpenPortsList = TryParsePorts(it.OpenPorts);
        }

        return Ok(items);
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

public class SystemAssetListItemDto
{
    public string IpAddress { get; set; } = default!;
    public string? Category { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Firmware { get; set; }
    public string? SerialNumber { get; set; }
    public string? Protocol { get; set; }
    public string? Status { get; set; }
    public int? WebPort { get; set; }
    public int? SdkPort { get; set; }
    public int? PreferredCredentialId { get; set; }
    public DateTime? LastSeenAt { get; set; }

    // crudo en DB
    public string? OpenPorts { get; set; }

    // parseado para UI
    public List<int> OpenPortsList { get; set; } = new();
}
