using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Agents;
using Inventario.Api.Services.Agents;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentJobsController : ControllerBase
{
    private readonly InventarioDbContext _db;
    private readonly AgentDispatchService _dispatcher;

    public AgentJobsController(InventarioDbContext db, AgentDispatchService dispatcher)
    {
        _db = db;
        _dispatcher = dispatcher;
    }

    [HttpGet]
    public async Task<ActionResult<List<AgentJobDto>>> Get(
        [FromQuery] int? installationId,
        [FromQuery] int? agentId,
        [FromQuery] string? status,
        [FromQuery] int? take,
        CancellationToken ct)
    {
        var query = _db.AgentJobs.AsNoTracking().Include(j => j.Installation).AsQueryable();

        if (installationId.HasValue)
            query = query.Where(j => j.InstallationId == installationId.Value);

        if (agentId.HasValue)
            query = query.Where(j => j.AssignedAgentId == agentId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(j => j.Status == status);

        var limit = take.GetValueOrDefault(200);
        if (limit < 1) limit = 1;
        if (limit > 500) limit = 500;

        var items = await query
            .OrderByDescending(j => j.CreatedAt)
            .Take(limit)
            .Select(j => new AgentJobDto
            {
                Id = j.Id,
                JobType = j.JobType,
                Status = j.Status,
                InstallationId = j.InstallationId,
                InstallationAbonadoMm = j.Installation != null ? j.Installation.AbonadoMm : null,
                NetworkId = j.NetworkId,
                TargetNetworkCidr = j.TargetNetworkCidr,
                AssignedAgentId = j.AssignedAgentId,
                Priority = j.Priority,
                ProgressPercent = j.ProgressPercent,
                LastProgressMessage = j.LastProgressMessage,
                ErrorMessage = j.ErrorMessage,
                ScanRunId = j.ScanRunId,
                CreatedAt = j.CreatedAt,
                StartedAt = j.StartedAt,
                CompletedAt = j.CompletedAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgentJobDto>> GetById(int id, CancellationToken ct)
    {
        var job = await _db.AgentJobs
            .AsNoTracking()
            .Include(j => j.Installation)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (job is null)
            return NotFound();

        return Ok(new AgentJobDto
        {
            Id = job.Id,
            JobType = job.JobType,
            Status = job.Status,
            InstallationId = job.InstallationId,
            InstallationAbonadoMm = job.Installation != null ? job.Installation.AbonadoMm : null,
            NetworkId = job.NetworkId,
            TargetNetworkCidr = job.TargetNetworkCidr,
            AssignedAgentId = job.AssignedAgentId,
            Priority = job.Priority,
            ProgressPercent = job.ProgressPercent,
            LastProgressMessage = job.LastProgressMessage,
            ErrorMessage = job.ErrorMessage,
            ScanRunId = job.ScanRunId,
            CreatedAt = job.CreatedAt,
            StartedAt = job.StartedAt,
            CompletedAt = job.CompletedAt
        });
    }

    [HttpPost]
    public async Task<ActionResult<AgentJobDto>> Create([FromBody] CreateAgentScanJobRequest request, CancellationToken ct)
    {
        var installId = request.InstallationId;
        if (installId is null && !string.IsNullOrWhiteSpace(request.AbonadoMm))
        {
            installId = await _db.Installations
                .AsNoTracking()
                .Where(x => x.AbonadoMm == request.AbonadoMm.Trim())
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (!installId.HasValue)
            return BadRequest("installationId or abonadoMm is required.");

        var installationExists = await _db.Installations.AsNoTracking().AnyAsync(i => i.Id == installId.Value, ct);
        if (!installationExists)
            return BadRequest("Installation not found.");

        string networkCidr;
        if (request.NetworkId.HasValue)
        {
            var network = await _db.Networks.AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.NetworkId.Value && n.InstallationId == installId.Value, ct);
            if (network is null)
                return BadRequest("NetworkId not found for this installation.");

            networkCidr = network.Cidr;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.NetworkCidr))
                return BadRequest("networkCidr is required.");

            networkCidr = request.NetworkCidr;
        }

        var payload = new AgentScanJobPayload
        {
            JobType = request.JobType,
            NetworkCidr = networkCidr,
            NetworkId = request.NetworkId,
            Ports = request.Ports,
            Protocols = request.Protocols,
            ConnectTimeoutMs = request.ConnectTimeoutMs,
            MaxConcurrency = request.MaxConcurrency,
            UseSsdp = request.UseSsdp,
            SsdpListenMs = request.SsdpListenMs,
            Scope = request.Scope,
            ApplyMode = request.ApplyMode
        };

        var job = new AgentJob
        {
            InstallationId = installId,
            NetworkId = request.NetworkId,
            TargetNetworkCidr = networkCidr,
            JobType = request.JobType,
            JobPayloadJson = JsonSerializer.Serialize(payload),
            Priority = request.Priority
        };

        _db.AgentJobs.Add(job);
        await _db.SaveChangesAsync(ct);

        await _dispatcher.DispatchQueuedJobsAsync(installId, ct);

        return CreatedAtAction(
            nameof(GetById),
            new { id = job.Id },
            new AgentJobDto
            {
                Id = job.Id,
                JobType = job.JobType,
                Status = job.Status,
                InstallationId = job.InstallationId,
                InstallationAbonadoMm = request.AbonadoMm,
                NetworkId = job.NetworkId,
                TargetNetworkCidr = job.TargetNetworkCidr,
                AssignedAgentId = job.AssignedAgentId,
                Priority = job.Priority,
                ProgressPercent = job.ProgressPercent,
                LastProgressMessage = job.LastProgressMessage,
                ErrorMessage = job.ErrorMessage,
                ScanRunId = job.ScanRunId,
                CreatedAt = job.CreatedAt,
                StartedAt = job.StartedAt,
                CompletedAt = job.CompletedAt
            });
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var job = await _db.AgentJobs.FirstOrDefaultAsync(j => j.Id == id, ct);
        if (job is null)
            return NotFound();

        if (string.Equals(job.Status, "Completed", StringComparison.OrdinalIgnoreCase)
            || string.Equals(job.Status, "Failed", StringComparison.OrdinalIgnoreCase)
            || string.Equals(job.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Job cannot be cancelled in its current state.");
        }

        job.Status = "Cancelled";
        job.CompletedAt = DateTime.UtcNow;
        job.UpdatedAt = DateTime.UtcNow;
        job.LastProgressMessage = "Cancelled";
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}
