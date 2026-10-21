using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DecisionWorkspace.Api.Controllers;

[ApiController]
[Route("api/marketplace-links")]
[Authorize]
public class MarketplaceLinksController : ControllerBase
{
    private readonly MarketplaceLinkService _marketplaceLinkService;
    private readonly ILogger<MarketplaceLinksController> _logger;

    public MarketplaceLinksController(
        MarketplaceLinkService marketplaceLinkService,
        ILogger<MarketplaceLinksController> logger
    )
    {
        _marketplaceLinkService = marketplaceLinkService;
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

            var resolvedUri =
                await _marketplaceLinkService.ResolveUrlAsync(
                    parsedUri!,
                    cancellationToken
                );

            if (resolvedUri == null)
            {
                return BadRequest(new
                {
                    message = "Unable to resolve marketplace link."
                });
            }

            var html =
                await _marketplaceLinkService.GetPageHtmlAsync(
                    resolvedUri,
                    cancellationToken
                );

            if (html == null)
            {
                return BadRequest(new
                {
                    message = "Unable to read marketplace product page."
                });
            }

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

            var imageUrl =
                jsonLd?.ImageUrl
                ?? metaImageUrl;

            var price =
                jsonLd?.Price
                ?? metaPrice;

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