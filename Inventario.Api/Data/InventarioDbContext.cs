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
    public DbSet<Network> Networks => Set<Network>();
    public DbSet<ScanRun> ScanRuns => Set<ScanRun>();
    public DbSet<ScanHostResult> ScanHostResults => Set<ScanHostResult>();

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

        // ----------------------------
        // Network (redes por instalación)
        // ----------------------------
        modelBuilder.Entity<Network>(entity =>
        {
            entity.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Cidr)
                .HasMaxLength(50)
                .IsRequired();

            // Relación con Installation
            entity.HasOne(x => x.Installation)
                .WithMany() // si luego añadimos Installation.Networks lo cambiamos
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Unicidad: no repetir nombre ni CIDR dentro de la instalación
            entity.HasIndex(x => new { x.InstallationId, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.InstallationId, x.Cidr }).IsUnique();
        });

        // ----------------------------
        // ScanRun (histórico de escaneos)
        // ----------------------------
        modelBuilder.Entity<ScanRun>(entity =>
        {
            entity.Property(x => x.NetworkCidr)
                .HasMaxLength(50)
                .IsRequired();

            entity.HasOne(x => x.Installation)
                .WithMany()
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Network)
                .WithMany()
                .HasForeignKey(x => x.NetworkId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ----------------------------
        // ScanHostResult (detalle por host en cada ScanRun)
        // ----------------------------
        modelBuilder.Entity<ScanHostResult>(entity =>
        {
            entity.Property(x => x.IpAddress)
                .HasMaxLength(45)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.OpenPortsJson)
                .IsRequired();

            entity.HasOne(x => x.ScanRun)
                .WithMany(sr => sr.HostResults)
                .HasForeignKey(x => x.ScanRunId)
                .OnDelete(DeleteBehavior.Cascade);

            // Evitar duplicados por run+ip
            entity.HasIndex(x => new { x.ScanRunId, x.IpAddress }).IsUnique();
        });
    }
}
