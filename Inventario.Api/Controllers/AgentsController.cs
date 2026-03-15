using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models.Agents;
using Inventario.Api.Services.Agents;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentsController : ControllerBase
{
    private const string AgentArtifactsFolder = "AgentArtifacts";
    private const string WindowsAgentBinary = "inventario-agent-win64.exe";
    private const string LinuxAgentBinary = "inventario-agent-linux-arm64";

    private readonly InventarioDbContext _db;
    private readonly IAgentTokenService _tokenService;
    private readonly IWebHostEnvironment _environment;

    public AgentsController(InventarioDbContext db, IAgentTokenService tokenService, IWebHostEnvironment environment)
    {
        _db = db;
        _tokenService = tokenService;
        _environment = environment;
    }

    [HttpGet]
    public async Task<ActionResult<List<AgentDto>>> Get([FromQuery] int? installationId, CancellationToken ct)
    {
        var query = _db.RemoteAgents.AsNoTracking().Include(a => a.Installation).AsQueryable();

        if (installationId.HasValue)
            query = query.Where(a => a.InstallationId == installationId.Value);

        var items = await query
            .OrderBy(a => a.IsOnline)
            .ThenBy(a => a.AgentCode)
            .Select(a => new AgentDto
            {
                Id = a.Id,
                AgentCode = a.AgentCode,
                FriendlyName = a.FriendlyName,
                InstallationId = a.InstallationId,
                InstallationAbonadoMm = a.Installation != null ? a.Installation.AbonadoMm : null,
                HostName = a.HostName,
                Os = a.Os,
                Architecture = a.Architecture,
                CurrentVersion = a.CurrentVersion,
                Status = a.Status,
                IsOnline = a.IsOnline,
                IsRevoked = a.IsRevoked,
                LastSeenAt = a.LastSeenAt,
                LastHeartbeatAt = a.LastHeartbeatAt,
                LastIpAddress = a.LastIpAddress
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgentDto>> GetById(int id, CancellationToken ct)
    {
        var agent = await _db.RemoteAgents
            .AsNoTracking()
            .Include(a => a.Installation)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        if (agent is null)
            return NotFound();

        return Ok(new AgentDto
        {
            Id = agent.Id,
            AgentCode = agent.AgentCode,
            FriendlyName = agent.FriendlyName,
            InstallationId = agent.InstallationId,
            HostName = agent.HostName,
            Os = agent.Os,
            Architecture = agent.Architecture,
            CurrentVersion = agent.CurrentVersion,
            Status = agent.Status,
            IsOnline = agent.IsOnline,
            IsRevoked = agent.IsRevoked,
            LastSeenAt = agent.LastSeenAt,
            LastHeartbeatAt = agent.LastHeartbeatAt,
            LastIpAddress = agent.LastIpAddress
        });
    }

    [HttpPost]
    public async Task<ActionResult<CreateAgentResponse>> Create([FromBody] CreateAgentRequest request, CancellationToken ct)
    {
        if (request.InstallationId.HasValue)
        {
            var installationExists = await _db.Installations
                .AsNoTracking()
                .AnyAsync(i => i.Id == request.InstallationId.Value, ct);
            if (!installationExists)
                return BadRequest("Installation not found.");
        }

        var agentCode = string.IsNullOrWhiteSpace(request.AgentCode)
            ? $"AG-{Guid.NewGuid():N}"[..10]
            : request.AgentCode.Trim();

        if (!string.IsNullOrWhiteSpace(request.AgentCode))
        {
            var code = request.AgentCode.Trim();
            if (await _db.RemoteAgents.AnyAsync(a => a.AgentCode == code, ct))
                return Conflict("agentCode already exists.");

            agentCode = code;
        }
        else
        {
            while (await _db.RemoteAgents.AnyAsync(a => a.AgentCode == agentCode, ct))
            {
                agentCode = $"AG-{Guid.NewGuid():N}"[..10];
            }
        }

        var enrollmentToken = _tokenService.GenerateToken();
        var agent = new RemoteAgent
        {
            AgentCode = agentCode,
            InstallationId = request.InstallationId,
            FriendlyName = request.FriendlyName,
            EnrollmentTokenHash = _tokenService.Hash(enrollmentToken),
            EnrollmentExpiresAt = DateTime.UtcNow.AddDays(7),
            Status = "PendingEnrollment"
        };

        _db.RemoteAgents.Add(agent);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(GetById),
            new { id = agent.Id },
            new CreateAgentResponse
            {
                AgentId = agent.Id,
                AgentCode = agent.AgentCode,
                EnrollmentToken = enrollmentToken,
                HubUrl = $"{Request.Scheme}://{Request.Host}/hubs/agents"
            });
    }

    [HttpPost("enroll")]
    public async Task<ActionResult<EnrollAgentResponse>> Enroll([FromBody] EnrollAgentRequest request, CancellationToken ct)
    {
        var agentCode = request.AgentCode.Trim();
        if (string.IsNullOrWhiteSpace(agentCode) || string.IsNullOrWhiteSpace(request.EnrollmentToken))
            return BadRequest("agentCode and enrollmentToken are required.");

        var agent = await _db.RemoteAgents.FirstOrDefaultAsync(a => a.AgentCode == agentCode, ct);
        if (agent is null)
            return NotFound("Agent not found.");

        if (agent.IsRevoked)
            return BadRequest("Agent is revoked.");

        if (!agent.EnrollmentExpiresAt.HasValue || agent.EnrollmentExpiresAt < DateTime.UtcNow)
            return BadRequest("Enrollment token expired.");

        if (!_tokenService.Verify(request.EnrollmentToken, agent.EnrollmentTokenHash))
            return Unauthorized("Enrollment token invalid.");

        var sessionToken = _tokenService.GenerateToken();
        agent.SessionTokenHash = _tokenService.Hash(sessionToken);
        agent.FriendlyName = string.IsNullOrWhiteSpace(request.AgentName) ? agent.FriendlyName : request.AgentName;
        agent.HostName = request.HostName ?? agent.HostName;
        agent.CurrentVersion = request.Version ?? agent.CurrentVersion;
        agent.Os = request.Os ?? agent.Os;
        agent.Architecture = request.Architecture ?? agent.Architecture;
        agent.Status = "Idle";
        agent.IsRevoked = false;
        agent.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new EnrollAgentResponse
        {
            AgentId = agent.Id,
            AgentCode = agent.AgentCode,
            InstallationId = agent.InstallationId,
            SessionToken = sessionToken,
            HubUrl = $"{Request.Scheme}://{Request.Host}/hubs/agents"
        });
    }

    [HttpPost("{id:int}/revoke")]
    public async Task<IActionResult> Revoke(int id, CancellationToken ct)
    {
        var agent = await _db.RemoteAgents.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (agent is null)
            return NotFound();

        agent.IsRevoked = true;
        agent.Status = "Revoked";
        agent.SessionTokenHash = null;
        agent.IsOnline = false;
        agent.LastConnectionId = null;
        agent.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:int}/installer")]
    public async Task<IActionResult> DownloadInstaller(
        int id,
        [FromQuery] string? token,
        [FromQuery] string? platform,
        CancellationToken ct)
    {
        var agent = await _db.RemoteAgents.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (agent is null)
            return NotFound("Agent not found.");

        if (agent.IsRevoked)
            return BadRequest("Agent is revoked.");

        if (string.IsNullOrWhiteSpace(token))
            return BadRequest("Token is required.");

        if (!agent.EnrollmentExpiresAt.HasValue || agent.EnrollmentExpiresAt < DateTime.UtcNow)
            return BadRequest("Enrollment token expired.");

        if (!_tokenService.Verify(token, agent.EnrollmentTokenHash))
            return Unauthorized("Enrollment token invalid.");

        var normalizedPlatform = string.IsNullOrWhiteSpace(platform) ? "windows" : platform.Trim().ToLowerInvariant();
        var isWindows = normalizedPlatform == "windows" || normalizedPlatform == "win" || normalizedPlatform == "ps1";
        var isLinux = normalizedPlatform == "linux" || normalizedPlatform == "linux64" || normalizedPlatform == "linux-arm64" || normalizedPlatform == "sh";

        if (!isWindows && !isLinux)
            return BadRequest("Unsupported platform.");

        var targetPlatform = isLinux ? "linux" : "windows";
        var apiBase = $"{Request.Scheme}://{Request.Host}";
        var hubUrl = $"{apiBase}/hubs/agents";
        var enrollmentUrl = $"{apiBase}/api/agents/enroll";

        var (binaryPath, binaryFileName) = ResolveBundledBinary(targetPlatform);
        var binaryPayload = binaryPath is null ? null : await System.IO.File.ReadAllBytesAsync(binaryPath, ct);

        var package = BuildInstallerPackage(
            agent.AgentCode,
            token,
            apiBase,
            hubUrl,
            enrollmentUrl,
            targetPlatform,
            binaryPayload,
            binaryFileName);
        var fileName = $"agent-installer-{agent.AgentCode}-{targetPlatform}.zip";

        return File(package, "application/zip", fileName);
    }

    private static byte[] BuildInstallerPackage(
        string agentCode,
        string enrollmentToken,
        string apiBase,
        string hubUrl,
        string enrollmentUrl,
        string platform,
        byte[]? agentBinary,
        string? bundledAgentBinaryName)
    {
        var hasBundledBinary = agentBinary is not null && bundledAgentBinaryName is not null;

        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            var readme = BuildInstallerReadme(
                agentCode,
                apiBase,
                hubUrl,
                enrollmentUrl,
                hasBundledBinary,
                bundledAgentBinaryName);
            var config = BuildInstallerConfig(
                agentCode,
                apiBase,
                hubUrl,
                enrollmentUrl,
                enrollmentToken,
                hasBundledBinary,
                bundledAgentBinaryName);

            AddTextToZip(archive, "README.txt", readme);
            AddTextToZip(archive, "agent-config.json", config);

            if (platform == "linux")
            {
                AddTextToZip(
                    archive,
                    "install-agent.sh",
                    BuildLinuxInstallScript(
                        agentCode,
                        enrollmentToken,
                        enrollmentUrl,
                        hubUrl,
                        hasBundledBinary,
                        bundledAgentBinaryName));
            }
            else
            {
                AddTextToZip(
                    archive,
                    "Install-Agent.ps1",
                    BuildWindowsInstallScript(
                        agentCode,
                        enrollmentToken,
                        enrollmentUrl,
                        hubUrl,
                        hasBundledBinary,
                        bundledAgentBinaryName));
            }

            if (hasBundledBinary && bundledAgentBinaryName is not null && agentBinary is not null)
            {
                AddBytesToZip(archive, bundledAgentBinaryName, agentBinary);
            }
        }

        return stream.ToArray();
    }

    private static void AddTextToZip(ZipArchive archive, string entryName, string content)
    {
        var entry = archive.CreateEntry(entryName);
        using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
        writer.Write(content);
    }

    private static void AddBytesToZip(ZipArchive archive, string entryName, byte[] content)
    {
        var entry = archive.CreateEntry(entryName);
        using var writer = new BinaryWriter(entry.Open());
        writer.Write(content);
    }

    private static string BuildInstallerReadme(
        string agentCode,
        string apiBase,
        string hubUrl,
        string enrollmentUrl,
        bool hasBundledBinary,
        string? bundledAgentBinaryName)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Inventario Remote Agent installer package");
        sb.AppendLine("======================================");
        sb.AppendLine($"Agent code: {agentCode}");
        sb.AppendLine($"API base: {apiBase}");
        sb.AppendLine($"Hub: {hubUrl}");
        sb.AppendLine($"Enroll endpoint: {enrollmentUrl}");
        sb.AppendLine("");
        sb.AppendLine("Included:");
        sb.AppendLine("- agent-config.json");
        sb.AppendLine("- Install-Agent.ps1 (Windows)");
        sb.AppendLine("- install-agent.sh (Linux)");
        if (hasBundledBinary && !string.IsNullOrWhiteSpace(bundledAgentBinaryName))
            sb.AppendLine($"- {bundledAgentBinaryName}");
        sb.AppendLine("");
        sb.AppendLine("Run the script for your platform. It will:");
        sb.AppendLine("- Enroll the agent in the platform.");
        sb.AppendLine("- Write agent-runtime.json.");
        sb.AppendLine("- Start the bundled binary if provided.");
        return sb.ToString();
    }

    private static string BuildInstallerConfig(
        string agentCode,
        string apiBase,
        string hubUrl,
        string enrollmentUrl,
        string enrollmentToken,
        bool hasBundledBinary,
        string? bundledAgentBinaryName)
    {
        var payload = new
        {
            version = 1,
            agentCode,
            apiBase,
            hubUrl,
            enrollment = new
            {
                url = enrollmentUrl,
                token = enrollmentToken
            },
            binary = new
            {
                hasBundledBinary,
                fileName = hasBundledBinary ? bundledAgentBinaryName : null
            },
            generatedAtUtc = DateTime.UtcNow
        };

        return JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
    }

    private static string BuildWindowsInstallScript(
        string agentCode,
        string enrollmentToken,
        string enrollmentUrl,
        string hubUrl,
        bool hasBundledBinary,
        string? bundledAgentBinaryName)
    {
        var sb = new StringBuilder();
        sb.AppendLine("$ErrorActionPreference = 'Stop'");
        sb.AppendLine("");
        sb.AppendLine($"$EnrollmentUrl = '{enrollmentUrl}'");
        sb.AppendLine("$ApiBase = $EnrollmentUrl -replace '/api/agents/enroll$', ''");
        sb.AppendLine($"$AgentCode = '{agentCode}'");
        sb.AppendLine($"$EnrollmentToken = '{enrollmentToken}'");
        sb.AppendLine($"$HubUrl = '{hubUrl}'");
        sb.AppendLine("$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path");
        sb.AppendLine("$RuntimeConfigPath = Join-Path $ScriptDir 'agent-runtime.json'");
        sb.AppendLine("Write-Host \"Validando enrollment...\"");
        sb.AppendLine("$payload = @{");
        sb.AppendLine("    agentCode = $AgentCode");
        sb.AppendLine("    enrollmentToken = $EnrollmentToken");
        sb.AppendLine("    agentName = $env:COMPUTERNAME");
        sb.AppendLine("    os = (Get-CimInstance Win32_OperatingSystem).Caption");
        sb.AppendLine("    architecture = $env:PROCESSOR_ARCHITECTURE");
        sb.AppendLine("} | ConvertTo-Json -Depth 5 -Compress");
        sb.AppendLine("try {");
        sb.AppendLine("    $resp = Invoke-RestMethod -Method Post -Uri $EnrollmentUrl -Body $payload -ContentType 'application/json' -TimeoutSec 30");
        sb.AppendLine("    $runtime = @{");
        sb.AppendLine("        agentId = $resp.agentId");
        sb.AppendLine("        agentCode = $resp.agentCode");
        sb.AppendLine("        sessionToken = $resp.sessionToken");
        sb.AppendLine("        installationId = $resp.installationId");
        sb.AppendLine("        apiBase = $ApiBase");
        sb.AppendLine("        hubUrl = $HubUrl");
        sb.AppendLine("        enrollmentUrl = $EnrollmentUrl");
        sb.AppendLine("        enrolledAtUtc = (Get-Date).ToString('o')");
        sb.AppendLine("    }");
        sb.AppendLine("    $runtime | ConvertTo-Json -Depth 5 | Set-Content -Path $RuntimeConfigPath -Encoding UTF8");
        sb.AppendLine("    Write-Host \"Enrollment ok. AgentId: $($resp.agentId) SessionToken: $($resp.sessionToken)\"");
        sb.AppendLine("    Write-Host \"Runtime file generated: $RuntimeConfigPath\"");
        if (hasBundledBinary && !string.IsNullOrWhiteSpace(bundledAgentBinaryName))
        {
            sb.AppendLine($"    $BinaryPath = Join-Path $ScriptDir '{bundledAgentBinaryName}'");
            sb.AppendLine("    if (Test-Path $BinaryPath) {");
            sb.AppendLine("        Write-Host \"Starting bundled agent binary...\"");
            sb.AppendLine("        Start-Process -FilePath $BinaryPath -ArgumentList ('--config', $RuntimeConfigPath) -WindowStyle Hidden");
            sb.AppendLine("    } else {");
            sb.AppendLine("        Write-Host \"Bundled binary not found. Run agent manually with --config $RuntimeConfigPath\"");
            sb.AppendLine("    }");
        }
        else
        {
            sb.AppendLine("    Write-Host \"No bundled binary in package. Download and run your agent binary with --config $RuntimeConfigPath\"");
        }
        sb.AppendLine("}");
        sb.AppendLine("catch {");
        sb.AppendLine("    Write-Error \"Enrollment failed: $($_.Exception.Message)\"");
        sb.AppendLine("    throw");
        sb.AppendLine("}");

        return sb.ToString();
    }

    private static string BuildLinuxInstallScript(
        string agentCode,
        string enrollmentToken,
        string enrollmentUrl,
        string hubUrl,
        bool hasBundledBinary,
        string? bundledAgentBinaryName)
    {
        var sb = new StringBuilder();
        sb.AppendLine("#!/usr/bin/env bash");
        sb.AppendLine("set -euo pipefail");
        sb.AppendLine("");
        sb.AppendLine($"ENROLL_URL='{enrollmentUrl}'");
        sb.AppendLine($"AGENT_CODE='{agentCode}'");
        sb.AppendLine($"ENROLL_TOKEN='{enrollmentToken}'");
        sb.AppendLine($"HUB_URL='{hubUrl}'");
        sb.AppendLine("SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"");
        sb.AppendLine("RUNTIME_PATH=\"$SCRIPT_DIR/agent-runtime.json\"");
        sb.AppendLine("PAYLOAD=\"{\\\"agentCode\\\":\\\"${AGENT_CODE}\\\",\\\"enrollmentToken\\\":\\\"${ENROLL_TOKEN}\\\",\\\"agentName\\\":\\\"$(hostname)\\\"}\"");
        sb.AppendLine("echo \"Validando enrollment...\"");
        sb.AppendLine("RESPONSE=$(curl -sSf -X POST \"$ENROLL_URL\" -H 'Content-Type: application/json' -d \"$PAYLOAD\")");
        sb.AppendLine("if command -v jq >/dev/null 2>&1; then");
        sb.AppendLine("  AGENT_ID=$(echo \"$RESPONSE\" | jq -r '.agentId // empty')");
        sb.AppendLine("  SESSION_TOKEN=$(echo \"$RESPONSE\" | jq -r '.sessionToken // empty')");
        sb.AppendLine("  INSTALLATION_ID=$(echo \"$RESPONSE\" | jq -r '.installationId // empty')");
        sb.AppendLine("else");
        sb.AppendLine("  AGENT_ID=$(echo \"$RESPONSE\" | tr -d '\\r' | sed -n 's/.*\"agentId\":\\([0-9][0-9]*\\).*/\\1/p')");
        sb.AppendLine("  SESSION_TOKEN=$(echo \"$RESPONSE\" | tr -d '\\r' | sed -n 's/.*\"sessionToken\":\"\\([^\"]*\\)\".*/\\1/p')");
        sb.AppendLine("  INSTALLATION_ID=$(echo \"$RESPONSE\" | tr -d '\\r' | sed -n 's/.*\"installationId\":\\([0-9][0-9]*\\).*/\\1/p')");
        sb.AppendLine("fi");
        sb.AppendLine("if [[ -z \"$SESSION_TOKEN\" ]]; then");
        sb.AppendLine("  echo \"Enrollment failed.\"");
        sb.AppendLine("  exit 1");
        sb.AppendLine("fi");
        sb.AppendLine("cat > \"$RUNTIME_PATH\" <<EOF");
        sb.AppendLine("{");
        sb.AppendLine("  \"agentId\": \"${AGENT_ID}\",");
        sb.AppendLine("  \"agentCode\": \"${AGENT_CODE}\",");
        sb.AppendLine("  \"sessionToken\": \"${SESSION_TOKEN}\",");
        sb.AppendLine("  \"installationId\": \"${INSTALLATION_ID}\",");
        sb.AppendLine("  \"apiBase\": \"${ENROLL_URL%/api/agents/enroll}\",");
        sb.AppendLine("  \"hubUrl\": \"${HUB_URL}\",");
        sb.AppendLine("  \"enrollmentUrl\": \"${ENROLL_URL}\",");
        sb.AppendLine("  \"enrolledAtUtc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"");
        sb.AppendLine("}");
        sb.AppendLine("EOF");
        sb.AppendLine("echo \"Enrollment ok. AgentId=$AGENT_ID SessionToken=$SESSION_TOKEN\"");
        sb.AppendLine("echo \"Runtime file generated: $RUNTIME_PATH\"");
        if (hasBundledBinary && !string.IsNullOrWhiteSpace(bundledAgentBinaryName))
        {
            sb.AppendLine($"BINARY_PATH=\"$SCRIPT_DIR/{bundledAgentBinaryName}\"");
            sb.AppendLine("if [ -f \"$BINARY_PATH\" ]; then");
            sb.AppendLine("  chmod +x \"$BINARY_PATH\"");
            sb.AppendLine("  nohup \"$BINARY_PATH\" --config \"$RUNTIME_PATH\" >/tmp/inventario-agent.log 2>&1 &");
            sb.AppendLine("  echo \"Agent started: $BINARY_PATH\"");
            sb.AppendLine("else");
            sb.AppendLine("  echo \"Bundled binary not found. Download and run your agent binary with --config $RUNTIME_PATH\"");
            sb.AppendLine("fi");
        }
        else
        {
            sb.AppendLine("echo \"No bundled binary in package. Download and run your agent binary with --config $RUNTIME_PATH\"");
        }
        sb.AppendLine("echo \"Script done.\"");

        return sb.ToString();
    }

    private (string?, string?) ResolveBundledBinary(string platform)
    {
        var fileName = platform == "linux" ? LinuxAgentBinary : WindowsAgentBinary;
        var candidateRoots = new List<string?>
        {
            System.IO.Path.Combine(_environment.ContentRootPath, AgentArtifactsFolder, fileName),
            System.IO.Path.Combine(_environment.WebRootPath ?? string.Empty, AgentArtifactsFolder, fileName),
            System.IO.Path.Combine(_environment.ContentRootPath, "wwwroot", AgentArtifactsFolder, fileName)
        };

        var resolved = candidateRoots.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && System.IO.File.Exists(path));
        return resolved is null ? (null, null) : (resolved, fileName);
    }
}
