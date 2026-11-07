namespace DecisionWorkspace.Api.Contracts;

public sealed class RefreshOptionImageRequest
{
    public required DateTimeOffset ExpectedUpdatedAt { get; set; }
    public bool ReplaceThumbnail { get; set; }
}
