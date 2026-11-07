using System.Net.Http.Headers;

namespace DecisionWorkspace.Api.Services;

public sealed class MarketplaceImageStorageService
{
    private const string BucketName =
        "marketplace-images";

    private const int MaxImageBytes =
        8 * 1024 * 1024;

    private readonly IHttpClientFactory
        _httpClientFactory;

    private readonly IConfiguration
        _configuration;

    private readonly ILogger<MarketplaceImageStorageService>
        _logger;

    public MarketplaceImageStorageService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<MarketplaceImageStorageService> logger
    )
    {
        _httpClientFactory =
            httpClientFactory;

        _configuration =
            configuration;

        _logger =
            logger;
    }

    public async Task<string?> ImportImageAsync(
        string? sourceImageUrl,
        CancellationToken cancellationToken = default
    )
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(20));

        try
        {
            return await ImportImageCoreAsync(sourceImageUrl, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Optional marketplace image import timed out.");
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException)
        {
            _logger.LogWarning("Optional marketplace image import failed ({FailureType}).", ex.GetType().Name);
            return null;
        }
    }

    // Only URLs returned for this application's unique import objects may be removed.
    public async Task DeleteImportedImageAsync(string publicUrl)
    {
        var prefix = $"{_configuration["Supabase:Url"]?.TrimEnd('/')}/storage/v1/object/public/{BucketName}/imports/";
        if (!publicUrl.StartsWith(prefix, StringComparison.Ordinal)) return;
        var fileName = publicUrl[prefix.Length..];
        if (fileName.Contains('/') || fileName.Contains('?') ||
            !Guid.TryParseExact(Path.GetFileNameWithoutExtension(fileName), "N", out _)) return;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var response = await _httpClientFactory.CreateClient("SupabaseStorage")
                .DeleteAsync($"object/{BucketName}/imports/{fileName}", timeout.Token);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("New image cleanup failed with status {StatusCode}", (int)response.StatusCode);
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or OperationCanceledException)
        { _logger.LogWarning("New image cleanup failed ({FailureType})", ex.GetType().Name); }
    }

    private async Task<string?> ImportImageCoreAsync(
        string? sourceImageUrl,
        CancellationToken cancellationToken
    )
    {
        if (
            string.IsNullOrWhiteSpace(
                sourceImageUrl
            ) ||
            !Uri.TryCreate(
                sourceImageUrl,
                UriKind.Absolute,
                out var sourceUri
            )
        )
        {
            return null;
        }

        if (
            sourceUri.Scheme !=
            Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(sourceUri.UserInfo)
        )
        {
            return null;
        }

        var imageBytes =
            await DownloadImageAsync(
                sourceUri,
                cancellationToken
            );

        if (imageBytes == null)
        {
            return null;
        }

        var extension =
            GetExtension(
                imageBytes.ContentType
            );

        var objectPath =
            $"imports/{Guid.NewGuid():N}{extension}";

        var storageClient =
            _httpClientFactory.CreateClient(
                "SupabaseStorage"
            );

        using var content =
            new ByteArrayContent(
                imageBytes.Bytes
            );

        content.Headers.ContentType =
            new MediaTypeHeaderValue(
                imageBytes.ContentType
            );

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"object/{BucketName}/{objectPath}"
            );

        request.Headers.TryAddWithoutValidation(
            "x-upsert",
            "false"
        );

        request.Content =
            content;

        using var response =
            await storageClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Supabase image upload failed with status {StatusCode}.",
                (int)response.StatusCode
            );

            return null;
        }

        var supabaseUrl =
            _configuration[
                "Supabase:Url"
            ];

        if (
            string.IsNullOrWhiteSpace(
                supabaseUrl
            )
        )
        {
            return null;
        }

        return
            $"{supabaseUrl.TrimEnd('/')}" +
            $"/storage/v1/object/public/" +
            $"{BucketName}/{objectPath}";
    }

    private async Task<DownloadedImage?>
        DownloadImageAsync(
            Uri sourceUri,
            CancellationToken cancellationToken
        )
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        cancellationToken = timeout.Token;

        if (
            !IsAllowedMarketplaceImageHost(
                sourceUri.Host
            )
        )
        {
            _logger.LogWarning(
                "Rejected marketplace image host {Host}",
                sourceUri.Host
            );

            return null;
        }

        var client =
            _httpClientFactory.CreateClient(
                "Marketplace"
            );

        using var request =
            new HttpRequestMessage(
                HttpMethod.Get,
                sourceUri
            );

        request.Headers.TryAddWithoutValidation(
            "Accept",
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        );

        request.Headers.TryAddWithoutValidation(
            "Referer",
            "https://www.tokopedia.com/"
        );

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
                "Marketplace image download failed with status {StatusCode} for {Host}",
                (int)response.StatusCode,
                sourceUri.Host
            );

            return null;
        }

        var contentType =
            response.Content.Headers
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
                "Marketplace returned invalid image content type {ContentType}",
                contentType
            );

            return null;
        }

        var contentLength =
            response.Content.Headers
                .ContentLength;

        if (
            contentLength.HasValue &&
            contentLength.Value >
                MaxImageBytes
        )
        {
            return null;
        }

        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var destination = new MemoryStream();
        var buffer = new byte[81920];
        while (true)
        {
            var count = await source.ReadAsync(buffer.AsMemory(), cancellationToken);
            if (count == 0) break;
            if (destination.Length + count > MaxImageBytes) return null;
            await destination.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
        }

        if (destination.Length == 0)
        {
            return null;
        }

        return new DownloadedImage(
            destination.ToArray(),
            contentType
        );
    }

    private static bool
        IsAllowedMarketplaceImageHost(
            string host
        )
    {
        return
            IsDomainOrSubdomain(
                host,
                "tokopedia-static.net"
            );
    }

    private static bool
        IsDomainOrSubdomain(
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

    private static string GetExtension(
        string contentType
    )
    {
        return contentType
            .ToLowerInvariant()
            switch
            {
                "image/jpeg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                "image/avif" => ".avif",
                _ => ".img"
            };
    }

    private sealed record DownloadedImage(
        byte[] Bytes,
        string ContentType
    );
}
