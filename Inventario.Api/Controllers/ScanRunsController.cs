using Inventario.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Inventario.Api.Models;
using System.Text;

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

    // DELETE /api/scanruns/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromBody] DeleteConfirmationDto dto, CancellationToken ct)
    {
        if (dto?.Confirmation?.Trim().ToLowerInvariant() != "delete")
            return BadRequest(new { message = "Confirmation text must be 'delete'." });

        // Cargar el ScanRun (no hace falta incluir hijos; contamos con query aparte)
        var scanRun = await _db.ScanRuns.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (scanRun == null)
            return NotFound(new { message = "ScanRun not found." });

        // Contar resultados afectados (para devolver resumen)
        var hostResultsCount = await _db.ScanHostResults
            .Where(h => h.ScanRunId == id)
            .CountAsync(ct);

        _db.ScanRuns.Remove(scanRun);

        // Si el cascade está bien en BD, esto borrará también ScanHostResults
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            message = "ScanRun deleted successfully.",
            deletedScanRunId = id,
            deletedHostResults = hostResultsCount
        });
    }

    // GET /api/scanruns/{id}/export.csv
    [HttpGet("{id:int}/export.csv")]
    public async Task<IActionResult> ExportCsv(int id, CancellationToken ct)
    {
        var run = await _db.ScanRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (run is null)
            return NotFound(new { message = "ScanRun not found." });

        // (Opcional) traer info de instalación y red para cabecera
        var installation = await _db.Installations
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == run.InstallationId, ct);

        var network = run.NetworkId.HasValue
            ? await _db.Networks.AsNoTracking().FirstOrDefaultAsync(n => n.Id == run.NetworkId.Value, ct)
            : null;

        var hosts = await _db.ScanHostResults
            .AsNoTracking()
            .Where(h => h.ScanRunId == id)
            .OrderBy(h => h.IpAddress)
            .Select(h => new
            {
                h.IpAddress,
                h.Status,
                h.OpenPortsJson,
                h.Manufacturer,
                h.Model,
                h.Firmware,
                h.SerialNumber,
                h.Protocol,
                h.WebPort,
                h.SdkPort,
                h.CredentialId,
                h.ErrorMessage
            })
            .ToListAsync(ct);

        var sb = new StringBuilder();

        // ---- Cabecera (comentarios CSV) ----
        sb.AppendLine($"# ScanRunId: {run.Id}");
        sb.AppendLine($"# Installation: {(installation?.AbonadoMm ?? "unknown")}");
        sb.AppendLine($"# Network: {(network is null ? run.NetworkCidr : $"{network.Name} ({network.Cidr})")}");
        sb.AppendLine($"# StartedAtUtc: {run.StartedAt:O}");
        sb.AppendLine($"# FinishedAtUtc: {(run.FinishedAt.HasValue ? run.FinishedAt.Value.ToString("O") : "")}");
        sb.AppendLine($"# TotalHosts: {run.TotalHosts}");
        sb.AppendLine($"# Authenticated: {run.AuthenticatedCount}");
        sb.AppendLine($"# Identified: {run.IdentifiedCount}");
        sb.AppendLine($"# NoPorts: {run.NoPortsCount}");
        sb.AppendLine();

        // ---- Header CSV ----
        sb.AppendLine(string.Join(",",
            "IpAddress",
            "Status",
            "OpenPorts",
            "Manufacturer",
            "Model",
            "Firmware",
            "SerialNumber",
            "Protocol",
            "WebPort",
            "SdkPort",
            "CredentialId",
            "ErrorMessage"
        ));

        foreach (var h in hosts)
        {
            // OpenPortsJson lo dejamos como string "[]" o "[80,443]"
            // si prefieres "80;443" lo adapto
            sb.AppendLine(string.Join(",",
                Csv(h.IpAddress),
                Csv(h.Status),
                Csv(h.OpenPortsJson ?? "[]"),
                Csv(h.Manufacturer),
                Csv(h.Model),
                Csv(h.Firmware),
                Csv(h.SerialNumber),
                Csv(h.Protocol),
                Csv(h.WebPort?.ToString()),
                Csv(h.SdkPort?.ToString()),
                Csv(h.CredentialId?.ToString()),
                Csv(h.ErrorMessage)
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());

        var started = run.StartedAt.ToString("yyyyMMdd_HHmmss");
        var fileName = $"scanrun_{run.Id}_{started}.csv";

        return File(bytes, "text/csv; charset=utf-8", fileName);
    }

    // Escapado CSV estándar (RFC4180-ish)
    private static string Csv(string? value)
    {
        value ??= "";
        var mustQuote = value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r');
        if (!mustQuote) return value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
}