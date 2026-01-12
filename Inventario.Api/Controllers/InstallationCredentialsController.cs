using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Models;
using Inventario.Api.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/installations/{abonadoMm}/credentials")]
public class InstallationCredentialsController : ControllerBase
{
    private readonly InventarioDbContext _db;
    private readonly ISecretProtector _secrets;

    public InstallationCredentialsController(InventarioDbContext db, ISecretProtector secrets)
    {
        _db = db;
        _secrets = secrets;
    }

    private static string NormalizeAbonado(string abonadoMm) => abonadoMm.Trim();

    private static string NormalizeUsername(string username) => username.Trim();

    private static string NormalizeScope(string? scope)
        => string.IsNullOrWhiteSpace(scope) ? "General" : scope.Trim();

    private async Task<Installation?> FindInstallationAsync(string abonadoMm, bool asNoTracking = false)
    {
        var ab = NormalizeAbonado(abonadoMm);

        var query = _db.Installations.AsQueryable();
        if (asNoTracking) query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync(x => x.AbonadoMm == ab);
    }

    // GET /api/installations/{abonadoMm}/credentials
    [HttpGet]
    public async Task<ActionResult<List<CredentialListItemDto>>> GetAll([FromRoute] string abonadoMm)
    {
        var installation = await FindInstallationAsync(abonadoMm, asNoTracking: true);
        if (installation is null)
            return NotFound(new { message = "Instalación no encontrada." });

        var items = await _db.InstallationCredentials
            .AsNoTracking()
            .Where(x => x.InstallationId == installation.Id)
            .OrderBy(x => x.Priority)
            .Select(x => new CredentialListItemDto
            {
                CredentialId = x.CredentialId,
                Username = x.Credential!.Username,
                Label = x.Credential.Label,
                Priority = x.Priority,
                Scope = x.Scope,
                IsActive = x.IsActive && x.Credential.IsActive,
                CreatedAt = x.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    // POST /api/installations/{abonadoMm}/credentials
    [HttpPost]
    public async Task<ActionResult> Add([FromRoute] string abonadoMm, [FromBody] CreateCredentialRequest request)
    {
        var installation = await FindInstallationAsync(abonadoMm);
        if (installation is null)
            return NotFound(new { message = "Instalación no encontrada." });

        var username = NormalizeUsername(request.Username);
        var scope = NormalizeScope(request.Scope);
        var usernameKey = username.ToLowerInvariant();
        var scopeKey = scope.ToLowerInvariant();

        // Evitar duplicados: misma instalación + username + scope (case-insensitive)
        var duplicate = await _db.InstallationCredentials
            .Where(x =>
                x.InstallationId == installation.Id &&
                x.Scope.ToLower() == scopeKey)
            .Join(
                _db.Credentials,
                ic => ic.CredentialId,
                c => c.Id,
                (ic, c) => new { ic, c }
            )
            .AnyAsync(x => x.c.Username.ToLower() == usernameKey);
        if (duplicate)
        {
            return Conflict(new
            {
                message = "Ya existe una credencial con el mismo username y scope para esta instalación.",
                username,
                scope
            });
        }

        var credential = new Credential
        {
            Username = username,
            PasswordProtected = _secrets.Protect(request.Password),
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim(),
            IsActive = request.IsActive
        };

        _db.Credentials.Add(credential);
        await _db.SaveChangesAsync(); // credential.Id

        var link = new InstallationCredential
        {
            InstallationId = installation.Id,
            CredentialId = credential.Id,
            Priority = request.Priority,
            Scope = scope,
            IsActive = request.IsActive
        };

        _db.InstallationCredentials.Add(link);
        await _db.SaveChangesAsync();

        return Created($"/api/installations/{NormalizeAbonado(abonadoMm)}/credentials", new
        {
            credentialId = credential.Id,
            username = credential.Username,
            scope = link.Scope,
            priority = link.Priority,
            isActive = link.IsActive
        });
    }

    // PUT /api/installations/{abonadoMm}/credentials/{credentialId}
    [HttpPut("{credentialId:int}")]
    public async Task<ActionResult> Update(
        [FromRoute] string abonadoMm,
        [FromRoute] int credentialId,
        [FromBody] UpdateCredentialRequest request)
    {
        var installation = await FindInstallationAsync(abonadoMm);
        if (installation is null)
            return NotFound(new { message = "Instalación no encontrada." });

        var link = await _db.InstallationCredentials
            .Include(x => x.Credential)
            .FirstOrDefaultAsync(x =>
                x.InstallationId == installation.Id &&
                x.CredentialId == credentialId);

        if (link is null)
            return NotFound(new { message = "Credencial no encontrada para esta instalación." });

        // Normalizamos scope si viene
        string? newScope = null;
        if (request.Scope is not null)
            newScope = NormalizeScope(request.Scope);

        // Si scope cambia, comprobar duplicado (misma instalación + username + scope)
        if (newScope is not null && !string.Equals(newScope, link.Scope, StringComparison.OrdinalIgnoreCase))
        {
            var username = link.Credential!.Username;
            var newScopeKey = newScope.ToLowerInvariant();
            var usernameKey = link.Credential!.Username.ToLowerInvariant();

            var duplicate = await _db.InstallationCredentials
                .Where(x =>
                    x.InstallationId == installation.Id &&
                    x.CredentialId != credentialId &&
                    x.Scope.ToLower() == newScopeKey)
                .Join(
                    _db.Credentials,
                    ic => ic.CredentialId,
                    c => c.Id,
                    (ic, c) => new { ic, c }
                )
                .AnyAsync(x => x.c.Username.ToLower() == usernameKey);
            if (duplicate)
            {
                return Conflict(new
                {
                    message = "No se puede actualizar: ya existe otra credencial con el mismo username y scope en esta instalación.",
                    username,
                    scope = newScope
                });
            }
        }

        if (request.Priority.HasValue)
            link.Priority = request.Priority.Value;

        if (newScope is not null)
            link.Scope = newScope;

        if (request.IsActive.HasValue)
        {
            link.IsActive = request.IsActive.Value;
            // Opción: también reflejarlo en la credencial global
            link.Credential!.IsActive = request.IsActive.Value;
        }

        if (request.Label is not null)
            link.Credential!.Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();

        await _db.SaveChangesAsync();

        return NoContent();
    }
}
