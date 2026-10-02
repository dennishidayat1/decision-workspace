namespace DecisionWorkspace.Api.Contracts;

public class CreateDecisionOptionRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
    public List<CreateDecisionOptionAttributeRequest> Attributes { get; set; } = [];
    public List<CreateOptionScoreRequest> Scores { get; set; } = [];
}