using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventario.Api.Migrations
{
    /// <inheritdoc />
    public partial class NetworkDeleteCascadeScanRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ScanRuns_Networks_NetworkId",
                table: "ScanRuns");

            migrationBuilder.AddForeignKey(
                name: "FK_ScanRuns_Networks_NetworkId",
                table: "ScanRuns",
                column: "NetworkId",
                principalTable: "Networks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ScanRuns_Networks_NetworkId",
                table: "ScanRuns");

            migrationBuilder.AddForeignKey(
                name: "FK_ScanRuns_Networks_NetworkId",
                table: "ScanRuns",
                column: "NetworkId",
                principalTable: "Networks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
