using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventario.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRemoteAgentsInfrastructure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RemoteAgentId",
                table: "SystemAssets",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SourceAgentId",
                table: "SystemAssets",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RemoteAgents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AgentCode = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    InstallationId = table.Column<int>(type: "INTEGER", nullable: true),
                    FriendlyName = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    HostName = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    Os = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    Architecture = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    CurrentVersion = table.Column<string>(type: "TEXT", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    IsOnline = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsRevoked = table.Column<bool>(type: "INTEGER", nullable: false),
                    EnrollmentTokenHash = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    SessionTokenHash = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    EnrollmentExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastConnectedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastHeartbeatAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastDisconnectedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastIpAddress = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    LastConnectionId = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RemoteAgents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RemoteAgents_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "AgentJobs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    JobType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    InstallationId = table.Column<int>(type: "INTEGER", nullable: true),
                    NetworkId = table.Column<int>(type: "INTEGER", nullable: true),
                    TargetNetworkCidr = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false),
                    JobPayloadJson = table.Column<string>(type: "TEXT", maxLength: 6000, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    Priority = table.Column<int>(type: "INTEGER", nullable: false),
                    ProgressPercent = table.Column<int>(type: "INTEGER", nullable: false),
                    LastProgressMessage = table.Column<string>(type: "TEXT", nullable: true),
                    ErrorMessage = table.Column<string>(type: "TEXT", nullable: true),
                    ScanRunId = table.Column<int>(type: "INTEGER", nullable: true),
                    AssignedAgentId = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentJobs_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AgentJobs_Networks_NetworkId",
                        column: x => x.NetworkId,
                        principalTable: "Networks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AgentJobs_RemoteAgents_AssignedAgentId",
                        column: x => x.AssignedAgentId,
                        principalTable: "RemoteAgents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AgentJobs_ScanRuns_ScanRunId",
                        column: x => x.ScanRunId,
                        principalTable: "ScanRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SystemAssets_RemoteAgentId",
                table: "SystemAssets",
                column: "RemoteAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAssets_SourceAgentId",
                table: "SystemAssets",
                column: "SourceAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentJobs_AssignedAgentId",
                table: "AgentJobs",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentJobs_InstallationId",
                table: "AgentJobs",
                column: "InstallationId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentJobs_NetworkId",
                table: "AgentJobs",
                column: "NetworkId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentJobs_ScanRunId",
                table: "AgentJobs",
                column: "ScanRunId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentJobs_Status_InstallationId_CreatedAt",
                table: "AgentJobs",
                columns: new[] { "Status", "InstallationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RemoteAgents_AgentCode",
                table: "RemoteAgents",
                column: "AgentCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RemoteAgents_InstallationId",
                table: "RemoteAgents",
                column: "InstallationId");

            migrationBuilder.AddForeignKey(
                name: "FK_SystemAssets_RemoteAgents_RemoteAgentId",
                table: "SystemAssets",
                column: "RemoteAgentId",
                principalTable: "RemoteAgents",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SystemAssets_RemoteAgents_SourceAgentId",
                table: "SystemAssets",
                column: "SourceAgentId",
                principalTable: "RemoteAgents",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SystemAssets_RemoteAgents_RemoteAgentId",
                table: "SystemAssets");

            migrationBuilder.DropForeignKey(
                name: "FK_SystemAssets_RemoteAgents_SourceAgentId",
                table: "SystemAssets");

            migrationBuilder.DropTable(
                name: "AgentJobs");

            migrationBuilder.DropTable(
                name: "RemoteAgents");

            migrationBuilder.DropIndex(
                name: "IX_SystemAssets_RemoteAgentId",
                table: "SystemAssets");

            migrationBuilder.DropIndex(
                name: "IX_SystemAssets_SourceAgentId",
                table: "SystemAssets");

            migrationBuilder.DropColumn(
                name: "RemoteAgentId",
                table: "SystemAssets");

            migrationBuilder.DropColumn(
                name: "SourceAgentId",
                table: "SystemAssets");
        }
    }
}
