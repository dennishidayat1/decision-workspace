namespace DecisionWorkspace.Api.Models;

public class DecisionOption
{
    public Guid Id { get; set; }
    public Guid DecisionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Decision Decision { get; set; } = null!;
}