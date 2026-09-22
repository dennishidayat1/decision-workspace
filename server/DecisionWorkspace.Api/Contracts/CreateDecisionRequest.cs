namespace DecisionWorkspace.Api.Contracts;

public class CreateDecisionRequest
{
    // Title: required string
    public string Title { get; set; } = string.Empty;
    // Question: required string
    public string Question { get; set; } = string.Empty;

    // Context: optional/nullable string
    public string? Context { get; set; }

    // Category: optional/nullable string
    public string? Category { get; set; }
}