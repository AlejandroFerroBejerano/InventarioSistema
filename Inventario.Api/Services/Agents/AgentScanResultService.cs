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

        var payloadModel = ParsePayload(job.JobPayloadJson);
        var applyMode = NormalizeApplyMode(payloadModel.ApplyMode);

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

        var candidateIps = targets
            .Where(h => !string.IsNullOrWhiteSpace(h.IpAddress))
            .Select(h => h.IpAddress)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingAssets = await _db.SystemAssets
            .Where(a => a.InstallationId == installationId && candidateIps.Contains(a.IpAddress))
            .ToDictionaryAsync(a => a.IpAddress, StringComparer.OrdinalIgnoreCase, ct);

        foreach (var host in targets)
        {
            if (string.Equals(host.Status, "NoPorts", StringComparison.OrdinalIgnoreCase))
                continue;

            if (string.IsNullOrWhiteSpace(host.IpAddress))
                continue;

            if (!existingAssets.TryGetValue(host.IpAddress, out var asset))
            {
                asset = new SystemAsset
                {
                    InstallationId = installationId,
                    IpAddress = host.IpAddress,
                    Category = string.IsNullOrWhiteSpace(host.Category) ? "Unknown" : host.Category!,
                    CreatedAt = now,
                    SourceAgentId = agent.Id
                };
                _db.SystemAssets.Add(asset);
                existingAssets[host.IpAddress] = asset;
            }

            asset.SourceAgentId = agent.Id;
            asset.LastSeenAt = now;
            asset.OpenPortsJson = JsonSerializer.Serialize(host.OpenPorts ?? new List<int>());
            asset.WebPort = host.WebPort ?? asset.WebPort;
            asset.SdkPort = host.SdkPort ?? asset.SdkPort;
            asset.Category = NormalizeCategory(host.Category, asset.Category);
            asset.Manufacturer = KeepIfBlank(asset.Manufacturer, host.Manufacturer);
            asset.Model = KeepIfBlank(asset.Model, host.Model);
            asset.Firmware = KeepIfBlank(asset.Firmware, host.Firmware);
            asset.SerialNumber = KeepIfBlank(asset.SerialNumber, host.SerialNumber);
            asset.Protocol = KeepIfBlank(asset.Protocol, host.Protocol);
            asset.Status = host.Status;

            if (applyMode is "LastWins")
            {
                asset.Category = string.IsNullOrWhiteSpace(host.Category) ? asset.Category : host.Category!;
                asset.Manufacturer = host.Manufacturer;
                asset.Model = host.Model;
                asset.Firmware = host.Firmware;
                asset.SerialNumber = host.SerialNumber;
                asset.Protocol = host.Protocol;
                asset.Status = host.Status;
            }
            else
            {
                asset.Category = KeepIfUnknown(asset.Category, host.Category);
            }

            if (string.Equals(host.Status, "Authenticated", StringComparison.OrdinalIgnoreCase)
                && host.CredentialId.HasValue)
            {
                asset.PreferredCredentialId = host.CredentialId.Value;
            }
        }

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

    private static AgentScanJobPayload ParsePayload(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<AgentScanJobPayload>(json) ?? new AgentScanJobPayload();
        }
        catch
        {
            return new AgentScanJobPayload();
        }
    }

    private static string NormalizeApplyMode(string? mode)
    {
        if (string.Equals(mode, "LastWins", StringComparison.OrdinalIgnoreCase)) return "LastWins";
        return "NoDegrade";
    }

    private static string? KeepIfBlank(string? current, string? incoming)
        => string.IsNullOrWhiteSpace(incoming) ? current : incoming;

    private static string? KeepIfUnknown(string? current, string? incoming)
    {
        if (string.IsNullOrWhiteSpace(incoming)) return current;
        if (string.Equals(incoming, "Unknown", StringComparison.OrdinalIgnoreCase)) return current;
        return incoming;
    }

    private static string? NormalizeCategory(string? current, string? incoming) => string.IsNullOrWhiteSpace(incoming) ? current : incoming;
}
