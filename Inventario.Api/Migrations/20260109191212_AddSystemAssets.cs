using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventario.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SystemAssets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    InstallationId = table.Column<int>(type: "INTEGER", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Manufacturer = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    Model = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    Firmware = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    SerialNumber = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    OpenPortsJson = table.Column<string>(type: "TEXT", nullable: false),
                    WebPort = table.Column<int>(type: "INTEGER", nullable: true),
                    SdkPort = table.Column<int>(type: "INTEGER", nullable: true),
                    Protocol = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    PreferredCredentialId = table.Column<int>(type: "INTEGER", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemAssets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SystemAssets_Credentials_PreferredCredentialId",
                        column: x => x.PreferredCredentialId,
                        principalTable: "Credentials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SystemAssets_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SystemAssets_InstallationId_IpAddress",
                table: "SystemAssets",
                columns: new[] { "InstallationId", "IpAddress" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SystemAssets_PreferredCredentialId",
                table: "SystemAssets",
                column: "PreferredCredentialId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemAssets");
        }
    }
}
