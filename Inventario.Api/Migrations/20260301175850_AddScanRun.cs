using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventario.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddScanRun : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScanRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    InstallationId = table.Column<int>(type: "INTEGER", nullable: false),
                    NetworkId = table.Column<int>(type: "INTEGER", nullable: true),
                    NetworkCidr = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TotalHosts = table.Column<int>(type: "INTEGER", nullable: false),
                    AuthenticatedCount = table.Column<int>(type: "INTEGER", nullable: false),
                    IdentifiedCount = table.Column<int>(type: "INTEGER", nullable: false),
                    NoPortsCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScanRuns_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScanRuns_Networks_NetworkId",
                        column: x => x.NetworkId,
                        principalTable: "Networks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScanRuns_InstallationId",
                table: "ScanRuns",
                column: "InstallationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScanRuns_NetworkId",
                table: "ScanRuns",
                column: "NetworkId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScanRuns");
        }
    }
}
