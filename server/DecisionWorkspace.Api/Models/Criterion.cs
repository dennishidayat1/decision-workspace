namespace DecisionWorkspace.Api.Models;

public class Criterion
{
    public Guid Id { get; set; }
    public Guid DecisionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Importance { get; set; }
    public string? Context { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Decision Decision { get; set; } = null!;
}