using Microsoft.AspNetCore.Mvc;

namespace DecisionWorkspace.Api.Controllers;

[ApiController]
[Route("api/marketplace")]
public sealed class MarketplaceImageController : ControllerBase
{
    private const int MaxImageBytes =
        8 * 1024 * 1024;

    private static readonly string[]
        AllowedImageDomains =
        [
            "tokopedia-static.net"
        ];

    private readonly IHttpClientFactory
        _httpClientFactory;

    private readonly ILogger<MarketplaceImageController>
        _logger;

    public MarketplaceImageController(
        IHttpClientFactory httpClientFactory,
        ILogger<MarketplaceImageController> logger
    )
    {
        _httpClientFactory =
            httpClientFactory;

        _logger =
            logger;
    }

    [HttpGet("image")]
    public async Task<IActionResult> GetImage(
        [FromQuery] string? url,
        CancellationToken cancellationToken
    )
    {
        if (
            !TryValidateImageUrl(
                url,
                out var imageUri
            )
        )
        {
            return ImageNotFound();
        }

        var client =
            _httpClientFactory
                .CreateClient("Marketplace");

        using var request =
            new HttpRequestMessage(
                HttpMethod.Get,
                imageUri
            );

        /*
         * Tokopedia's image CDN may reject generic
         * server-side HTTP requests.
         *
         * Send normal browser image-request headers.
         */
        request.Headers.TryAddWithoutValidation(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/141.0.0.0 Safari/537.36"
        );

        request.Headers.TryAddWithoutValidation(
            "Accept",
            "image/avif,image/webp,image/apng,image/svg+xml," +
            "image/*,*/*;q=0.8"
        );

        request.Headers.TryAddWithoutValidation(
            "Accept-Language",
            "en-US,en;q=0.9,id;q=0.8"
        );

        request.Headers.TryAddWithoutValidation(
            "Referer",
            "https://www.tokopedia.com/"
        );

        try
        {
            using var response =
                await client.SendAsync(
                    request,
                    HttpCompletionOption
                        .ResponseHeadersRead,
                    cancellationToken
                );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Marketplace image returned {StatusCode}. URL: {Url}",
                    (int)response.StatusCode,
                    imageUri
                );

                /*
                 * Don't return JSON here.
                 *
                 * This endpoint is consumed by <img>,
                 * so JSON/HTML errors trigger Firefox ORB noise.
                 */
                return ImageNotFound();
            }

            var contentType =
                response.Content
                    .Headers
                    .ContentType?
                    .MediaType;

            if (
                string.IsNullOrWhiteSpace(
                    contentType
                ) ||
                !contentType.StartsWith(
                    "image/",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                _logger.LogWarning(
                    "Marketplace image returned invalid Content-Type {ContentType}. URL: {Url}",
                    contentType,
                    imageUri
                );

                return ImageNotFound();
            }

            var contentLength =
                response.Content
                    .Headers
                    .ContentLength;

            if (
                contentLength.HasValue &&
                contentLength.Value >
                MaxImageBytes
            )
            {
                _logger.LogWarning(
                    "Marketplace image exceeded maximum size. URL: {Url}",
                    imageUri
                );

                return ImageNotFound();
            }

            await using var source =
                await response.Content
                    .ReadAsStreamAsync(
                        cancellationToken
                    );

            using var destination =
                new MemoryStream();

            var buffer =
                new byte[81920];

            while (true)
            {
                var bytesRead =
                    await source.ReadAsync(
                        buffer.AsMemory(
                            0,
                            buffer.Length
                        ),
                        cancellationToken
                    );

                if (bytesRead == 0)
                {
                    break;
                }

                if (
                    destination.Length + bytesRead >
                    MaxImageBytes
                )
                {
                    _logger.LogWarning(
                        "Marketplace image exceeded maximum size while streaming. URL: {Url}",
                        imageUri
                    );

                    return ImageNotFound();
                }

                await destination.WriteAsync(
                    buffer.AsMemory(
                        0,
                        bytesRead
                    ),
                    cancellationToken
                );
            }

            if (destination.Length == 0)
            {
                return ImageNotFound();
            }

            /*
             * Signed Tokopedia URLs are temporary,
             * so don't cache them for too long.
             */
            Response.Headers.CacheControl =
                "public,max-age=1800";

            return File(
                destination.ToArray(),
                contentType
            );
        }
        catch (OperationCanceledException)
            when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Marketplace image request timed out. URL: {Url}",
                imageUri
            );

            return ImageNotFound();
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(
                exception,
                "Marketplace image request failed. URL: {Url}",
                imageUri
            );

            return ImageNotFound();
        }
        catch (IOException)
        {
            _logger.LogWarning("Marketplace image stream failed for {Host}", imageUri.Host);
            return ImageNotFound();
        }
    }

    private IActionResult ImageNotFound()
    {
        Response.StatusCode = StatusCodes.Status404NotFound;
        return new EmptyResult();
    }

    private static bool TryValidateImageUrl(
        string? value,
        out Uri imageUri
    )
    {
        imageUri = null!;

        if (
            string.IsNullOrWhiteSpace(
                value
            ) ||
            !Uri.TryCreate(
                value,
                UriKind.Absolute,
                out var uri
            )
        )
        {
            return false;
        }

        if (
            uri.Scheme !=
                Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(
                uri.UserInfo
            )
        )
        {
            return false;
        }

        var allowed =
            AllowedImageDomains.Any(
                domain =>
                    IsDomainOrSubdomain(
                        uri.Host,
                        domain
                    )
            );

        if (!allowed)
        {
            return false;
        }

        imageUri = uri;

        return true;
    }

    private static bool IsDomainOrSubdomain(
        string host,
        string domain
    )
    {
        return
            host.Equals(
                domain,
                StringComparison.OrdinalIgnoreCase
            ) ||
            host.EndsWith(
                "." + domain,
                StringComparison.OrdinalIgnoreCase
            );
    }
}
