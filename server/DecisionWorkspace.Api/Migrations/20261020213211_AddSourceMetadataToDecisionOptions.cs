using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DecisionWorkspace.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceMetadataToDecisionOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "DecisionOptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceName",
                table: "DecisionOptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "DecisionOptions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "DecisionOptions");

            migrationBuilder.DropColumn(
                name: "SourceName",
                table: "DecisionOptions");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "DecisionOptions");
        }
    }
}
