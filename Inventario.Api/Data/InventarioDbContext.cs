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
    public DbSet<RemoteAgent> RemoteAgents => Set<RemoteAgent>();
    public DbSet<AgentJob> AgentJobs => Set<AgentJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<InstallationCredential>()
            .HasKey(x => new { x.InstallationId, x.CredentialId });

        modelBuilder.Entity<InstallationCredential>()
            .HasOne(x => x.Installation)
            .WithMany(i => i.InstallationCredentials)
            .HasForeignKey(x => x.InstallationId);

        modelBuilder.Entity<InstallationCredential>()
            .HasOne(x => x.Credential)
            .WithMany(c => c.InstallationCredentials)
            .HasForeignKey(x => x.CredentialId);

        modelBuilder.Entity<Installation>()
            .HasIndex(x => x.AbonadoMm)
            .IsUnique();

        modelBuilder.Entity<SystemAsset>(entity =>
        {
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

            entity.HasOne(x => x.PreferredCredential)
                  .WithMany()
                  .HasForeignKey(x => x.PreferredCredentialId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.SourceAgent)
                  .WithMany()
                  .HasForeignKey(x => x.SourceAgentId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Network>(entity =>
        {
            entity.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Cidr)
                .HasMaxLength(50)
                .IsRequired();

            entity.HasOne(x => x.Installation)
                .WithMany()
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.InstallationId, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.InstallationId, x.Cidr }).IsUnique();
        });

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

            entity.HasIndex(x => new { x.ScanRunId, x.IpAddress }).IsUnique();
        });

        modelBuilder.Entity<RemoteAgent>(entity =>
        {
            entity.HasIndex(x => x.AgentCode).IsUnique();

            entity.Property(x => x.AgentCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.EnrollmentTokenHash)
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.SessionTokenHash)
                .HasMaxLength(128);

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.FriendlyName)
                .HasMaxLength(80);

            entity.Property(x => x.HostName)
                .HasMaxLength(80);

            entity.Property(x => x.Os)
                .HasMaxLength(120);

            entity.Property(x => x.Architecture)
                .HasMaxLength(30);

            entity.Property(x => x.CurrentVersion)
                .HasMaxLength(40);

            entity.Property(x => x.LastIpAddress)
                .HasMaxLength(64);

            entity.Property(x => x.LastConnectionId)
                .HasMaxLength(120);

            entity.HasOne(x => x.Installation)
                .WithMany()
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AgentJob>(entity =>
        {
            entity.Property(x => x.JobType)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.JobPayloadJson)
                .HasMaxLength(6000)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.TargetNetworkCidr)
                .HasMaxLength(60)
                .IsRequired();

            entity.HasOne(x => x.AssignedAgent)
                .WithMany(a => a.Jobs)
                .HasForeignKey(x => x.AssignedAgentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.Installation)
                .WithMany()
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.Network)
                .WithMany()
                .HasForeignKey(x => x.NetworkId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.ScanRun)
                .WithMany()
                .HasForeignKey(x => x.ScanRunId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => new { x.Status, x.InstallationId, x.CreatedAt });
        });
    }
}
