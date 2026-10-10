using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DecisionWorkspace.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDecisionUserOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "Decisions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Decisions_UserId",
                table: "Decisions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Decisions_UserId",
                table: "Decisions");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Decisions");
        }
    }
}
