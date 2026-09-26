using System.ComponentModel.DataAnnotations;

namespace DecisionWorkspace.Api.Contracts;

public class CreateOptionScoreRequest
{
    public Guid CriterionId { get; set; }
    [Range(1, 5)]
    public int Score { get; set; }
    public string? Comment { get; set; }
}