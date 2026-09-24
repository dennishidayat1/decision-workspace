namespace DecisionWorkspace.Api.Contracts;

public class CreateDecisionRequest
{
    public string Title { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string? Context { get; set; }
    public string? Category { get; set; }
}