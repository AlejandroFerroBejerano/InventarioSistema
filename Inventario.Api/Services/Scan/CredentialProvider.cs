using Inventario.Api.Data;
using Inventario.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Services.Scan;

public record PlainCredential(int CredentialId, string Username, string Password, int Priority);

public class CredentialProvider
{
    private readonly InventarioDbContext _db;
    private readonly ISecretProtector _secrets;

    public CredentialProvider(InventarioDbContext db, ISecretProtector secrets)
    {
        _db = db;
        _secrets = secrets;
    }

    public async Task<List<PlainCredential>> GetActiveCredentialsAsync(string abonadoMm, CancellationToken ct)
    {
        var installation = await _db.Installations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.AbonadoMm == abonadoMm.Trim(), ct);

        if (installation is null) return new();

        var items = await _db.InstallationCredentials
            .AsNoTracking()
            .Include(x => x.Credential)
            .Where(x => x.InstallationId == installation.Id)
            .Where(x => x.IsActive && x.Credential!.IsActive)
            .OrderBy(x => x.Priority)
            .Select(x => new
            {
                x.CredentialId,
                x.Credential!.Username,
                x.Credential.PasswordProtected,
                x.Priority
            })
            .ToListAsync(ct);

        return items.Select(x => new PlainCredential(
            x.CredentialId,
            x.Username,
            _secrets.Unprotect(x.PasswordProtected),
            x.Priority)).ToList();
    }
}
