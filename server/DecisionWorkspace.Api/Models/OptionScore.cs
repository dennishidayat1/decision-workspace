namespace DecisionWorkspace.Api.Models;

public class OptionScore
{
    public Guid DecisionOptionId { get; set; }
    public Guid CriterionId { get; set; }
    public int Score { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DecisionOption DecisionOption { get; set; } = null!;
    public Criterion Criterion { get; set; } = null!;
}