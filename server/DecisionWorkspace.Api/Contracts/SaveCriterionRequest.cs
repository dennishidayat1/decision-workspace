namespace DecisionWorkspace.Api.Contracts;

public class SaveCriterionRequest
{
    public Guid? Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public int Importance { get; set; }

    public string? Context { get; set; }
}