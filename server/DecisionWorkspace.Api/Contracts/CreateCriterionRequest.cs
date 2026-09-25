namespace DecisionWorkspace.Api.Contracts;

using System.ComponentModel.DataAnnotations;

public class CreateCriterionRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;
    [Range(1, 5)]
    public int Importance { get; set; }
    public string? Context { get; set; }
}