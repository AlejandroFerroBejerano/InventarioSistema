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
    public DbSet<SystemAsset> SystemAssets => Set<SystemAsset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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

        // ----------------------------
        // SystemAsset (hosts de red)
        // ----------------------------
        modelBuilder.Entity<SystemAsset>(entity =>
        {
            // Un host por instalación e IP
            entity.HasIndex(x => new { x.InstallationId, x.IpAddress })
                  .IsUnique();

            entity.Property(x => x.IpAddress)
                  .HasMaxLength(45)
                  .IsRequired();

            entity.Property(x => x.Category)
                  .HasMaxLength(20)
                  .IsRequired();

            entity.Property(x => x.OpenPortsJson)
                  .IsRequired();

            entity.Property(x => x.Protocol)
                  .HasMaxLength(30);

            entity.Property(x => x.Status)
                  .HasMaxLength(20);

            // Credencial preferida opcional (si se borra credencial -> null)
            entity.HasOne(x => x.PreferredCredential)
                  .WithMany()
                  .HasForeignKey(x => x.PreferredCredentialId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
