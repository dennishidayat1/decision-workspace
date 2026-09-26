using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DecisionWorkspace.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOptionScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OptionScores",
                columns: table => new
                {
                    DecisionOptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriterionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptionScores", x => new { x.DecisionOptionId, x.CriterionId });
                    table.ForeignKey(
                        name: "FK_OptionScores_Criteria_CriterionId",
                        column: x => x.CriterionId,
                        principalTable: "Criteria",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OptionScores_DecisionOptions_DecisionOptionId",
                        column: x => x.DecisionOptionId,
                        principalTable: "DecisionOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OptionScores_CriterionId",
                table: "OptionScores",
                column: "CriterionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OptionScores");
        }
    }
}
