using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Hubs;
using Inventario.Api.Models.Agents;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Services.Agents;

public class AgentDispatchService
{
    private readonly InventarioDbContext _db;
    private readonly IHubContext<AgentHub> _hub;
    private readonly ILogger<AgentDispatchService> _logger;

    public AgentDispatchService(InventarioDbContext db, IHubContext<AgentHub> hub, ILogger<AgentDispatchService> logger)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
    }

    public async Task<int> DispatchQueuedJobsAsync(int? installationId, CancellationToken ct)
    {
        var jobs = _db.AgentJobs
            .Where(j => j.Status == "Queued" && j.AssignedAgentId == null);

        if (installationId.HasValue)
            jobs = jobs.Where(j => j.InstallationId == installationId.Value);

        var pendingJobs = await jobs
            .OrderByDescending(j => j.Priority)
            .ThenBy(j => j.CreatedAt)
            .ToListAsync(ct);

        var dispatched = 0;

        foreach (var job in pendingJobs)
        {
            if (ct.IsCancellationRequested) break;

            var agent = await FindAvailableAgentAsync(job, ct);
            if (agent is null)
                break;

            try
            {
                await DispatchToAgentAsync(agent, job, ct);
                dispatched++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error dispatching job {JobId} to agent {AgentId}", job.Id, agent.Id);
                job.Status = "Queued";
                job.AssignedAgentId = null;
                job.UpdatedAt = DateTime.UtcNow;
                job.LastProgressMessage = "DispatchFailed";
                job.ErrorMessage = $"Could not dispatch: {ex.Message}";
                await _db.SaveChangesAsync(ct);
            }
        }

        return dispatched;
    }

    private async Task<RemoteAgent?> FindAvailableAgentAsync(AgentJob job, CancellationToken ct)
    {
        var query = _db.RemoteAgents
            .Where(a => a.IsOnline && !a.IsRevoked && !string.IsNullOrWhiteSpace(a.LastConnectionId));

        if (job.InstallationId.HasValue)
            query = query.Where(a => a.InstallationId == job.InstallationId.Value);

        return await query
            .OrderByDescending(a => a.LastHeartbeatAt ?? a.LastSeenAt ?? DateTime.MinValue)
            .FirstOrDefaultAsync(ct);
    }

    private async Task DispatchToAgentAsync(RemoteAgent agent, AgentJob job, CancellationToken ct)
    {
        var payload = TryDeserializePayload(job);
        var assignment = new AgentWorkAssignmentDto
        {
            JobId = job.Id,
            JobType = job.JobType,
            NetworkId = job.NetworkId,
            TargetNetworkCidr = job.TargetNetworkCidr,
            Priority = job.Priority,
            JobPayloadJson = job.JobPayloadJson,
            Payload = payload
        };

        job.AssignedAgentId = agent.Id;
        job.Status = "Dispatched";
        job.StartedAt = DateTime.UtcNow;
        job.ProgressPercent = 5;
        job.LastProgressMessage = "Dispatched";
        job.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _hub.Clients.Client(agent.LastConnectionId!)
            .SendAsync("JobAssigned", assignment, ct);
    }

    private static AgentScanJobPayload TryDeserializePayload(AgentJob job)
    {
        try
        {
            return JsonSerializer.Deserialize<AgentScanJobPayload>(job.JobPayloadJson) ?? new AgentScanJobPayload();
        }
        catch
        {
            return new AgentScanJobPayload();
        }
    }
}
