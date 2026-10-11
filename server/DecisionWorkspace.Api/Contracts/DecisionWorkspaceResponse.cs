using DecisionWorkspace.Api.Models;

namespace DecisionWorkspace.Api.Contracts;

public class DecisionWorkspaceResponse
{
    public required Decision Decision { get; set; }

    public List<DecisionOption> Options { get; set; } = [];

    public List<Criterion> Criteria { get; set; } = [];

    public List<DecisionOptionAttribute> Attributes { get; set; } = [];

    public List<OptionScore> Scores { get; set; } = [];
}