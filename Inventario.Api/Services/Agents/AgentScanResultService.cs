using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Agents;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Services.Agents;

public class AgentScanResultService
{
    private readonly InventarioDbContext _db;

    public AgentScanResultService(InventarioDbContext db)
    {
        _db = db;
    }

    public async Task<int?> StoreScanResultAsync(RemoteAgent agent, AgentScanResultDto payload, CancellationToken ct)
    {
        var job = await _db.AgentJobs
            .FirstOrDefaultAsync(j => j.Id == payload.JobId, ct);

        if (job is null || job.AssignedAgentId != agent.Id)
            return null;

        if (!payload.Success)
        {
            job.Status = "Failed";
            job.ErrorMessage = payload.ErrorMessage;
            job.ProgressPercent = 100;
            job.CompletedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            job.LastProgressMessage = "ScanFailed";
            await _db.SaveChangesAsync(ct);
            return null;
        }

        if (!job.InstallationId.HasValue)
        {
            job.Status = "Failed";
            job.ErrorMessage = "No installation associated with job.";
            job.ProgressPercent = 100;
            job.CompletedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            job.LastProgressMessage = "ScanFailed";
            await _db.SaveChangesAsync(ct);
            return null;
        }

        var installationId = job.InstallationId.Value;
        var targets = payload.Hosts ?? new();
        var now = DateTime.UtcNow;

        var scanRun = new ScanRun
        {
            InstallationId = installationId,
            NetworkId = job.NetworkId,
            NetworkCidr = job.TargetNetworkCidr,
            StartedAt = job.StartedAt ?? now,
            FinishedAt = now,
            TotalHosts = targets.Count,
            NoPortsCount = targets.Count(h => string.Equals(h.Status, "NoPorts", StringComparison.OrdinalIgnoreCase)),
            IdentifiedCount = targets.Count(h => string.Equals(h.Status, "Identified", StringComparison.OrdinalIgnoreCase)),
            AuthenticatedCount = targets.Count(h => string.Equals(h.Status, "Authenticated", StringComparison.OrdinalIgnoreCase)),
            CreatedAt = now
        };

        _db.ScanRuns.Add(scanRun);
        await _db.SaveChangesAsync(ct);

        var hostResults = targets.Select(h => new ScanHostResult
        {
            ScanRunId = scanRun.Id,
            IpAddress = h.IpAddress,
            Status = string.IsNullOrWhiteSpace(h.Status) ? "Found" : h.Status,
            OpenPortsJson = JsonSerializer.Serialize(h.OpenPorts ?? new List<int>()),
            Manufacturer = h.Manufacturer,
            Model = h.Model,
            Firmware = h.Firmware,
            SerialNumber = h.SerialNumber,
            Protocol = h.Protocol,
            WebPort = h.WebPort,
            SdkPort = h.SdkPort,
            CredentialId = h.CredentialId,
            CreatedAt = now
        }).ToList();

        if (hostResults.Count > 0)
            _db.ScanHostResults.AddRange(hostResults);

        job.Status = "Completed";
        job.ScanRunId = scanRun.Id;
        job.ProgressPercent = 100;
        job.ErrorMessage = null;
        job.CompletedAt = now;
        job.LastProgressMessage = payload.ExecutionSummary;
        job.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);

        return scanRun.Id;
    }
}
