using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DecisionWorkspace.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDecisionOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DecisionOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DecisionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Url = table.Column<string>(type: "text", nullable: true),
                    ThumbnailUrl = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Price = table.Column<decimal>(type: "numeric", nullable: true),
                    Currency = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DecisionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DecisionOptions_Decisions_DecisionId",
                        column: x => x.DecisionId,
                        principalTable: "Decisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DecisionOptions_DecisionId",
                table: "DecisionOptions",
                column: "DecisionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DecisionOptions");
        }
    }
}
