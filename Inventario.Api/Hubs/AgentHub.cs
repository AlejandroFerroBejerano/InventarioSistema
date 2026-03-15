using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Agents;
using Inventario.Api.Services.Agents;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Inventario.Api.Hubs;

public class AgentHub : Hub
{
    private const string AgentContextKey = "agentId";
    private readonly InventarioDbContext _db;
    private readonly AgentScanResultService _scanResultService;
    private readonly IAgentTokenService _tokenService;
    private readonly ILogger<AgentHub> _logger;

    public AgentHub(
        InventarioDbContext db,
        AgentScanResultService scanResultService,
        IAgentTokenService tokenService,
        ILogger<AgentHub> logger)
    {
        _db = db;
        _scanResultService = scanResultService;
        _tokenService = tokenService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var context = Context.GetHttpContext();
        if (!TryParseAgentContext(context, out var agentId, out var token))
        {
            Context.Abort();
            return;
        }

        var agent = await _db.RemoteAgents.FirstOrDefaultAsync(a => a.Id == agentId, Context.ConnectionAborted);
        if (agent is null || agent.IsRevoked)
        {
            Context.Abort();
            return;
        }

        if (!_tokenService.Verify(token, agent.SessionTokenHash))
        {
            Context.Abort();
            return;
        }

        Context.Items[AgentContextKey] = agent.Id;

        var remoteIp = context?.Connection.RemoteIpAddress?.ToString();

        agent.IsOnline = true;
        agent.Status = string.IsNullOrWhiteSpace(agent.Status) || agent.Status == "PendingEnrollment" ? "Idle" : agent.Status;
        agent.LastSeenAt = DateTime.UtcNow;
        agent.LastConnectedAt = DateTime.UtcNow;
        agent.LastHeartbeatAt = DateTime.UtcNow;
        agent.LastIpAddress = remoteIp;
        agent.LastConnectionId = Context.ConnectionId;
        agent.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await Clients.Caller.SendAsync("SessionAccepted", new { agentId = agent.Id, status = agent.Status, serverTime = DateTime.UtcNow });
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var agent = await GetCurrentAgentAsync();
        if (agent != null)
        {
            agent.IsOnline = false;
            agent.Status = "Offline";
            agent.LastSeenAt = DateTime.UtcNow;
            agent.LastDisconnectedAt = DateTime.UtcNow;
            agent.LastConnectionId = null;
            agent.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        await base.OnDisconnectedAsync(exception);
    }

    [HubMethodName("Heartbeat")]
    public async Task Heartbeat(AgentHeartbeatDto payload)
    {
        var agent = await GetCurrentAgentAsync();
        if (agent is null)
            return;

        if (!string.IsNullOrWhiteSpace(payload.AgentName))
            agent.FriendlyName = payload.AgentName;

        if (!string.IsNullOrWhiteSpace(payload.HostName))
            agent.HostName = payload.HostName;

        if (!string.IsNullOrWhiteSpace(payload.Version))
            agent.CurrentVersion = payload.Version;

        if (!string.IsNullOrWhiteSpace(payload.Os))
            agent.Os = payload.Os;

        if (!string.IsNullOrWhiteSpace(payload.Architecture))
            agent.Architecture = payload.Architecture;

        if (!string.IsNullOrWhiteSpace(payload.Status))
            agent.Status = payload.Status;

        if (!string.IsNullOrWhiteSpace(payload.LocalIp))
            agent.LastIpAddress = payload.LocalIp;

        agent.IsOnline = true;
        agent.LastSeenAt = DateTime.UtcNow;
        agent.LastHeartbeatAt = DateTime.UtcNow;
        agent.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task PollWork(string? jobType = null)
    {
        var agent = await GetCurrentAgentAsync();
        if (agent is null)
            return;

        var query = _db.AgentJobs
            .Where(j => j.Status == "Queued" && j.AssignedAgentId == null)
            .Where(j => j.InstallationId == null || j.InstallationId == agent.InstallationId);

        if (!string.IsNullOrWhiteSpace(jobType))
            query = query.Where(j => j.JobType == jobType);

        var job = await query
            .OrderByDescending(j => j.Priority)
            .ThenBy(j => j.CreatedAt)
            .FirstOrDefaultAsync();

        if (job is null)
            return;

        await AssignJobToAgentAsync(agent, job);
    }

    public async Task Progress(int jobId, int percent, string? message = null)
    {
        var agent = await GetCurrentAgentAsync();
        if (agent is null)
            return;

        var job = await _db.AgentJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.AssignedAgentId == agent.Id);

        if (job is null)
            return;

        var clamped = Math.Clamp(percent, 0, 100);
        job.ProgressPercent = clamped;
        job.LastProgressMessage = message;
        job.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(message) && message!.Length > 300)
            job.LastProgressMessage = message[..300];

        await _db.SaveChangesAsync();
    }

    public async Task SubmitResult(AgentScanResultDto payload)
    {
        var agent = await GetCurrentAgentAsync();
        if (agent is null)
            return;

        var scanRunId = await _scanResultService.StoreScanResultAsync(agent, payload, Context.ConnectionAborted);

        if (scanRunId is null)
        {
            _logger.LogWarning("Could not store scan result for agent {AgentId}, job {JobId}", agent.Id, payload.JobId);
            return;
        }

        await Clients.Caller.SendAsync("ResultStored", new { jobId = payload.JobId, scanRunId });
    }

    private async Task AssignJobToAgentAsync(RemoteAgent agent, AgentJob job)
    {
        var payload = DeserializePayload(job);

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

        await _db.SaveChangesAsync();
        await Clients.Caller.SendAsync("JobAssigned", assignment);
    }

    private static AgentScanJobPayload DeserializePayload(AgentJob job)
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

    private async Task<RemoteAgent?> GetCurrentAgentAsync()
    {
        if (!Context.Items.TryGetValue(AgentContextKey, out var idObj) || idObj is not int agentId)
            return null;

        return await _db.RemoteAgents.FirstOrDefaultAsync(a => a.Id == agentId);
    }

    private static bool TryParseAgentContext(HttpContext? context, out int agentId, out string token)
    {
        agentId = 0;
        token = string.Empty;

        if (context is null)
            return false;

        var query = context.Request.Query;
        if (!int.TryParse(query["agentId"], out agentId))
            return false;

        var candidate = query["agentToken"].ToString();
        if (string.IsNullOrWhiteSpace(candidate))
            return false;

        token = candidate;
        return true;
    }
}
