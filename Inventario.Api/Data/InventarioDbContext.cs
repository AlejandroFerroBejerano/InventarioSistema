using Inventario.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inventario.Api.Data;

public class InventarioDbContext : DbContext
{
    public InventarioDbContext(DbContextOptions<InventarioDbContext> options)
        : base(options)
    {
    }

    public DbSet<Installation> Installations => Set<Installation>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<InstallationCredential> InstallationCredentials => Set<InstallationCredential>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Clave compuesta (InstallationId + CredentialId)
        modelBuilder.Entity<InstallationCredential>()
            .HasKey(x => new { x.InstallationId, x.CredentialId });

        // Relaciones
        modelBuilder.Entity<InstallationCredential>()
            .HasOne(x => x.Installation)
            .WithMany(i => i.InstallationCredentials)
            .HasForeignKey(x => x.InstallationId);

        modelBuilder.Entity<InstallationCredential>()
            .HasOne(x => x.Credential)
            .WithMany(c => c.InstallationCredentials)
            .HasForeignKey(x => x.CredentialId);

        // Unicidad: abonadoMM único
        modelBuilder.Entity<Installation>()
            .HasIndex(x => x.AbonadoMm)
            .IsUnique();
    }
}
