using System.Net;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Diagnostics;

namespace DecisionWorkspace.Api.Services;

public class MarketplaceLinkService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MarketplaceLinkService> _logger;
    private static readonly Dictionary<string, string> SupportedDomains =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["shopee.co.id"] = "Shopee",
            ["shp.ee"] = "Shopee",
            ["tokopedia.com"] = "Tokopedia"
        };

    public MarketplaceLinkService(
        IHttpClientFactory httpClientFactory,
        ILogger<MarketplaceLinkService> logger
    )
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public bool TryDetectMarketplace(
        string url,
        out string? sourceName,
        out Uri? parsedUri
    )
    {
        sourceName = null;
        parsedUri = null;

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo))
        {
            return false;
        }

        var marketplace = DetectMarketplace(uri.Host);

        if (marketplace == null)
        {
            return false;
        }

        sourceName = marketplace;
        parsedUri = uri;

        return true;
    }

    private static string? DetectMarketplace(string host)
    {
        foreach (var (domain, marketplace) in SupportedDomains)
        {
            if (
                host.Equals(
                    domain,
                    StringComparison.OrdinalIgnoreCase
                ) ||
                host.EndsWith(
                    "." + domain,
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                return marketplace;
            }
        }

        return null;
    }

    public async Task<(Uri Uri, string Html)?> GetPageAsync(
        Uri initialUri,
        CancellationToken cancellationToken = default,
        string? requestId = null)
    {
        const int maxRedirects = 5;

        var currentUri = initialUri;
        var client = _httpClientFactory.CreateClient("Marketplace");

        for (var i = 0; i <= maxRedirects; i++)
        {
            if (!TryDetectMarketplace(currentUri.ToString(), out _, out _))
            {
                return null;
            }

            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                currentUri
            );

            // ResponseHeadersRead ends HttpClient's timeout at the headers. Keep the
            // same per-request budget active while reading the final HTML body.
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            if (client.Timeout != Timeout.InfiniteTimeSpan)
                deadline.CancelAfter(client.Timeout);
            var stage = "response_headers";
            var elapsed = Stopwatch.StartNew();
            try
            {
                using var response = await client.SendAsync(
                    request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
                _logger.LogInformation(
                    "Marketplace stage {Stage} completed for {Host} hop {Hop} with status {StatusCode} in {ElapsedMs} ms; RequestId {RequestId}",
                    stage, currentUri.Host, i, (int)response.StatusCode, elapsed.ElapsedMilliseconds, requestId);

                if (!IsRedirect(response.StatusCode))
                {
                    if (!response.IsSuccessStatusCode) return null;
                    stage = "html_body";
                    elapsed.Restart();
                    var html = await response.Content.ReadAsStringAsync(deadline.Token);
                    _logger.LogInformation(
                        "Marketplace stage {Stage} completed for {Host} hop {Hop} in {ElapsedMs} ms; RequestId {RequestId}",
                        stage, currentUri.Host, i, elapsed.ElapsedMilliseconds, requestId);
                    return (currentUri, html);
                }

                var location = response.Headers.Location;
                if (location == null) return null;
                currentUri = location.IsAbsoluteUri
                    ? location
                    : new Uri(currentUri, location);
            }
            catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex,
                    "Marketplace stage {Stage} timed out for {Host} hop {Hop} after {ElapsedMs} ms; RequestId {RequestId}",
                    stage, currentUri.Host, i, elapsed.ElapsedMilliseconds, requestId);
                throw;
            }
        }

        return null;
    }

    private static bool IsRedirect(System.Net.HttpStatusCode statusCode)
    {
        return statusCode is
            System.Net.HttpStatusCode.Moved or
            System.Net.HttpStatusCode.Redirect or
            System.Net.HttpStatusCode.RedirectMethod or
            System.Net.HttpStatusCode.TemporaryRedirect or
            System.Net.HttpStatusCode.PermanentRedirect;
    }

    public string? ExtractMetaContent(
        string html,
        string propertyName
    )
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var propertyPattern =
            $"<meta[^>]+property=[\"']{Regex.Escape(propertyName)}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>";

        var propertyMatch = Regex.Match(
            html,
            propertyPattern,
            RegexOptions.IgnoreCase
        );

        if (propertyMatch.Success)
        {
            return WebUtility.HtmlDecode(
                propertyMatch.Groups[1].Value
            );
        }

        var reversedPattern =
            $"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']{Regex.Escape(propertyName)}[\"'][^>]*>";

        var reversedMatch = Regex.Match(
            html,
            reversedPattern,
            RegexOptions.IgnoreCase
        );

        if (reversedMatch.Success)
        {
            return WebUtility.HtmlDecode(
                reversedMatch.Groups[1].Value
            );
        }

        return null;
    }

    private static JsonElement? FindProductNode(
        JsonElement element
    )
    {
        if (element.ValueKind ==
            JsonValueKind.Object)
        {
            if (
                element.TryGetProperty(
                    "@type",
                    out var type
                ) &&
                IsProductType(type)
            )
            {
                return element;
            }

            if (
                element.TryGetProperty(
                    "@graph",
                    out var graph
                )
            )
            {
                var result =
                    FindProductNode(graph);

                if (result != null)
                {
                    return result;
                }
            }

            foreach (
                var property
                in element.EnumerateObject()
            )
            {
                var result =
                    FindProductNode(
                        property.Value
                    );

                if (result != null)
                {
                    return result;
                }
            }
        }

        if (element.ValueKind ==
            JsonValueKind.Array)
        {
            foreach (
                var item
                in element.EnumerateArray()
            )
            {
                var result =
                    FindProductNode(item);

                if (result != null)
                {
                    return result;
                }
            }
        }

        return null;
    }

    private static bool IsProductType(
        JsonElement type
    )
    {
        if (type.ValueKind ==
            JsonValueKind.String)
        {
            return string.Equals(
                type.GetString(),
                "Product",
                StringComparison.OrdinalIgnoreCase
            );
        }

        if (type.ValueKind ==
            JsonValueKind.Array)
        {
            return type
                .EnumerateArray()
                .Any(item =>
                    item.ValueKind ==
                        JsonValueKind.String &&
                    string.Equals(
                        item.GetString(),
                        "Product",
                        StringComparison.OrdinalIgnoreCase
                    )
                );
        }

        return false;
    }


    public MarketplaceProductMetadata? ExtractProductJsonLd(string html)
    {
        var matches = Regex.Matches(
            html,
            @"<script[^>]*type=[""']application/ld\+json[""'][^>]*>(.*?)</script>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline
        );

        foreach (Match match in matches)
        {
            var json = WebUtility.HtmlDecode(
                match.Groups[1].Value.Trim()
            );

            if (string.IsNullOrWhiteSpace(json))
            {
                continue;
            }

            try
            {
                using var document =
                    JsonDocument.Parse(json);

                var product =
                    FindProductNode(
                        document.RootElement
                    );

                if (product == null)
                {
                    continue;
                }

                return ParseProductMetadata(
                    product.Value
                );
            }
            catch (JsonException)
            {
                // Ignore malformed JSON-LD blocks.
            }
        }

        return null;
    }

    private static MarketplaceProductMetadata
    ParseProductMetadata(
        JsonElement product
    )
    {
        var metadata =
            new MarketplaceProductMetadata();

        if (
            product.TryGetProperty(
                "name",
                out var name
            ) &&
            name.ValueKind ==
                JsonValueKind.String
        )
        {
            metadata.Title =
                name.GetString();
        }

        if (
            product.TryGetProperty(
                "description",
                out var description
            ) &&
            description.ValueKind ==
                JsonValueKind.String
        )
        {
            metadata.Description =
                description.GetString();
        }

        if (
            product.TryGetProperty(
                "image",
                out var image
            )
        )
        {
            metadata.ImageUrl =
                ExtractImageUrl(image);
        }

        if (
            product.TryGetProperty(
                "offers",
                out var offers
            )
        )
        {
            ExtractOfferData(
                offers,
                metadata
            );
        }

        return metadata;
    }

    private static string? ExtractImageUrl(
    JsonElement image
)
    {
        if (image.ValueKind ==
            JsonValueKind.String)
        {
            return image.GetString();
        }

        if (image.ValueKind ==
            JsonValueKind.Array)
        {
            foreach (
                var item
                in image.EnumerateArray()
            )
            {
                if (
                    item.ValueKind ==
                    JsonValueKind.String
                )
                {
                    return item.GetString();
                }

                if (
                    item.ValueKind ==
                        JsonValueKind.Object &&
                    item.TryGetProperty(
                        "url",
                        out var itemUrl
                    ) &&
                    itemUrl.ValueKind ==
                        JsonValueKind.String
                )
                {
                    return itemUrl.GetString();
                }
            }
        }

        if (
            image.ValueKind ==
                JsonValueKind.Object &&
            image.TryGetProperty(
                "url",
                out var url
            ) &&
            url.ValueKind ==
                JsonValueKind.String
        )
        {
            return url.GetString();
        }

        return null;
    }

    private static void ExtractOfferData(
    JsonElement offers,
    MarketplaceProductMetadata metadata
)
    {
        JsonElement? offer = null;

        if (
            offers.ValueKind ==
            JsonValueKind.Object
        )
        {
            offer = offers;
        }
        else if (
            offers.ValueKind ==
            JsonValueKind.Array
        )
        {
            foreach (
                var item
                in offers.EnumerateArray()
            )
            {
                if (
                    item.ValueKind ==
                    JsonValueKind.Object
                )
                {
                    offer = item;
                    break;
                }
            }
        }

        if (offer == null)
        {
            return;
        }

        if (
            offer.Value.TryGetProperty(
                "priceCurrency",
                out var currency
            ) &&
            currency.ValueKind ==
                JsonValueKind.String
        )
        {
            metadata.Currency =
                currency.GetString();
        }

        if (
            offer.Value.TryGetProperty(
                "price",
                out var price
            )
        )
        {
            if (
                price.ValueKind ==
                    JsonValueKind.Number &&
                price.TryGetDecimal(
                    out var decimalPrice
                )
            )
            {
                metadata.Price = decimalPrice;
            }
            else if (price.ValueKind == JsonValueKind.String)
            {
                metadata.Price = ParsePrice(price.GetString());
            }
        }
    }

    public string? NormalizeCurrency(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim().ToUpperInvariant() switch
        {
            "RP" => "IDR",
            "IDR" => "IDR",
            "USD" => "USD",
            "EUR" => "EUR",
            "GBP" => "GBP",
            "CAD" => "CAD",
            "AUD" => "AUD",
            _ => value.Trim().ToUpperInvariant()
        };
    }

    public static decimal? ParsePrice(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return decimal.TryParse(
            value.Trim(),
            out var parsed
        )
            ? parsed
            : null;
    }

}

public sealed class MarketplaceProductMetadata
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
}
