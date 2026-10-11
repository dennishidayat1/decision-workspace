namespace DecisionWorkspace.Api.Contracts;

public class CreateDecisionWorkspaceRequest
{
    public string Title { get; set; } = string.Empty;

    public string Question { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string? Context { get; set; }

    public List<CreateCriterionRequest> Criteria { get; set; } = [];
}