using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;

namespace DecisionWorkspace.Api.Controllers;

[ApiController]
[Route("api/marketplace-links")]
[Authorize]
public class MarketplaceLinksController : ControllerBase
{
    private readonly MarketplaceLinkService _marketplaceLinkService;
    private readonly MarketplaceImageStorageService _marketplaceImageStorageService;
    private readonly ILogger<MarketplaceLinksController> _logger;

    public MarketplaceLinksController(
        MarketplaceLinkService marketplaceLinkService,
        MarketplaceImageStorageService marketplaceImageStorageService,
        ILogger<MarketplaceLinksController> logger
    )
    {
        _marketplaceLinkService = marketplaceLinkService;
        _marketplaceImageStorageService = marketplaceImageStorageService;
        _logger = logger;
    }

    [HttpPost("preview")]
    public async Task<IActionResult> Preview(
        PreviewMarketplaceLinkRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Url))
            {
                return BadRequest(new
                {
                    message = "URL is required."
                });
            }

            var sourceUrl = request.Url.Trim();

            if (!_marketplaceLinkService.TryDetectMarketplace(
                    sourceUrl,
                    out var sourceName,
                    out var parsedUri))
            {
                return BadRequest(new
                {
                    message = "Unsupported marketplace link."
                });
            }

            var requestId = HttpContext?.Request.Headers["Rndr-Id"].ToString();
            if (string.IsNullOrWhiteSpace(requestId)) requestId = HttpContext?.TraceIdentifier;
            var page =
                await _marketplaceLinkService.GetPageAsync(
                    parsedUri!,
                    cancellationToken,
                    requestId
                );

            if (page == null)
            {
                return BadRequest(new
                {
                    message = "Unable to read marketplace product page."
                });
            }

            var (resolvedUri, html, renderingFallback) = page.Value;
            var jsonLd =
                _marketplaceLinkService.ExtractProductJsonLd(
                    html
                );

            var metaTitle =
                _marketplaceLinkService.ExtractMetaContent(
                    html,
                    "og:title"
                );

            var metaDescription =
                _marketplaceLinkService.ExtractMetaContent(
                    html,
                    "og:description"
                );

            var metaImageUrl =
                _marketplaceLinkService.ExtractMetaContent(
                    html,
                    "og:image"
                );

            var metaPriceText =
                _marketplaceLinkService.ExtractMetaContent(
                    html,
                    "product:price:amount"
                );

            var metaCurrency =
                _marketplaceLinkService.ExtractMetaContent(
                    html,
                    "product:price:currency"
                );

            var metaPrice =
                MarketplaceLinkService.ParsePrice(
                    metaPriceText
                );

            var rawCurrency =
                jsonLd?.Currency
                ?? metaCurrency;

            var currency =
                _marketplaceLinkService.NormalizeCurrency(
                    rawCurrency
                );

            var title =
                jsonLd?.Title
                ?? metaTitle;

            var description =
                jsonLd?.Description
                ?? metaDescription;

            var marketplaceImageUrl =
                jsonLd?.ImageUrl
                ?? metaImageUrl;

            var price = jsonLd?.Price ?? metaPrice;
            var hasTitle = !string.IsNullOrWhiteSpace(title);
            var hasImage = !string.IsNullOrWhiteSpace(marketplaceImageUrl);
            var hasPrice = price.HasValue;
            var outcome = "metadata_missing";
            if (hasTitle && hasImage && hasPrice)
                outcome = "metadata_complete";
            else if (hasTitle || hasImage || hasPrice || !string.IsNullOrWhiteSpace(description))
                outcome = "metadata_partial";
            else if (Regex.IsMatch(html, @"<title\b[^>]*>\s*(?:Access Denied|Request Blocked|Verify (?:that )?you are human)\s*</title>", RegexOptions.IgnoreCase))
                outcome = "access_restricted";
            else if (renderingFallback || (sourceName == "Tokopedia" &&
                Regex.IsMatch(html, @"<div\b[^>]*\s+id\s*=\s*[""']zeus-root[""'][^>]*>\s*</div>", RegexOptions.IgnoreCase)))
                outcome = "upstream_rendering_fallback";

            _logger.LogInformation(
                "Marketplace outcome {Outcome} for {Host}; title {HasTitle}, price {HasPrice}, image {HasImage}, SSR timing fallback {RenderingFallback}; RequestId {RequestId}",
                outcome, resolvedUri.Host, hasTitle, hasPrice, hasImage, renderingFallback, requestId);

            var imageUrl =
                await _marketplaceImageStorageService
                    .ImportImageAsync(
                        marketplaceImageUrl,
                        cancellationToken
                    )
                ?? marketplaceImageUrl;

            return Ok(
                new MarketplaceLinkPreviewResponse
                {
                    SourceUrl = sourceUrl,
                    CanonicalUrl = resolvedUri.ToString(),
                    SourceName = sourceName,
                    Title = title,
                    Description = description,
                    ImageUrl = imageUrl,
                    Price = price,
                    Currency = currency
                }
            );
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
            when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Marketplace preview timed out for {Url}",
                request.Url
            );

            return StatusCode(
                StatusCodes.Status504GatewayTimeout,
                new
                {
                    message = "Marketplace took too long to respond. Please try again."
                }
            );
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ex,
                "Marketplace HTTP request failed for {Url}",
                request.Url
            );

            return StatusCode(
                StatusCodes.Status502BadGateway,
                new
                {
                    message = "Unable to reach marketplace."
                }
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unexpected marketplace preview failure for {Url}",
                request.Url
            );

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    message = "Failed to preview marketplace product."
                }
            );
        }
    }
}
