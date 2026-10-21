namespace DecisionWorkspace.Api.Contracts;

public class MarketplaceLinkPreviewResponse
{
    public required string SourceUrl { get; set; }

    public string? CanonicalUrl { get; set; }

    public string? SourceName { get; set; }

    public string? Title { get; set; }
    public string? Description  { get; set; }

    public string? ImageUrl { get; set; }

    public decimal? Price { get; set; }

    public string? Currency { get; set; }
}