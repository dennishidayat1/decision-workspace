using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;

namespace DecisionWorkspace.Api.Services;

public sealed record ImageRecoveryResult(int Status, string? Code = null, string? Message = null, DecisionOption? Option = null);

public sealed class OptionImageRecoveryService(
    IOptionImageRepository repository,
    MarketplaceLinkService marketplace,
    MarketplaceImageStorageService storage,
    ILogger<OptionImageRecoveryService> logger)
{
    public async Task<ImageRecoveryResult> RefreshAsync(Guid userId, Guid decisionId, Guid optionId,
        RefreshOptionImageRequest request, CancellationToken token)
    {
        var option = await repository.FindOwnedAsync(userId, decisionId, optionId, token);
        if (option == null) return new(404, "option_not_found", "Option was not found.");
        if (option.UpdatedAt != request.ExpectedUpdatedAt)
            return Conflict();
        if (string.IsNullOrWhiteSpace(option.SourceUrl))
            return new(422, "source_url_missing", "This option has no saved marketplace source URL.");
        if (!marketplace.TryDetectMarketplace(option.SourceUrl, out _, out var sourceUri))
            return new(422, "source_url_unsupported", "The saved source is not a supported marketplace URL.");
        if (!request.ReplaceThumbnail && !string.IsNullOrWhiteSpace(option.ThumbnailUrl) &&
            !string.Equals(option.ThumbnailUrl.Trim(), option.ImageUrl?.Trim(), StringComparison.Ordinal))
            return new(409, "thumbnail_confirmation_required", "Confirm replacement of your current thumbnail.");

        string? imageUrl;
        try
        {
            var resolved = await marketplace.ResolveUrlAsync(sourceUri!, token);
            var html = resolved == null ? null : await marketplace.GetPageHtmlAsync(resolved, token);
            imageUrl = html == null ? null : marketplace.ExtractProductJsonLd(html)?.ImageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl) && html != null)
                imageUrl = marketplace.ExtractMetaContent(html, "og:image");
            if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var imageUri) ||
                imageUri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(imageUri.UserInfo))
                return new(422, "metadata_image_missing", "The marketplace page did not provide a usable image.");
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        { return new(504, "metadata_timeout", "The marketplace took too long to respond. Try again."); }
        catch (HttpRequestException)
        { return new(502, "metadata_fetch_failed", "Unable to read the marketplace product page. Try again."); }

        var uploaded = await storage.ImportImageAsync(imageUrl, token);
        if (uploaded == null)
            return new(502, "image_storage_failed", "Unable to save the marketplace image. Your current image was preserved.");

        var committed = false;
        var cleanupSafe = true;
        try
        {
            // PostgreSQL stores microseconds; ensure the token advances even for rapid requests.
            var updatedAt = DateTimeOffset.UtcNow;
            updatedAt = new DateTimeOffset(updatedAt.Ticks - updatedAt.Ticks % 10, TimeSpan.Zero);
            if (updatedAt <= option.UpdatedAt) updatedAt = option.UpdatedAt.AddTicks(10);
            committed = await repository.TrySetImageAsync(userId, option, uploaded, updatedAt, token);
            if (!committed) return Conflict();
            option.ImageUrl = uploaded;
            option.ThumbnailUrl = uploaded;
            option.UpdatedAt = updatedAt;
            return new(200, Option: option);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save recovered image for option {OptionId}", optionId);
            // A lost database acknowledgement can follow a successful commit. Never
            // delete an image that may now be referenced, or when verification fails.
            cleanupSafe = false;
            try
            {
                using var verifyTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                var current = await repository.FindOwnedAsync(userId, decisionId, optionId, verifyTimeout.Token);
                cleanupSafe = current == null || (current.ImageUrl != uploaded && current.ThumbnailUrl != uploaded);
            }
            catch (Exception verifyException)
            { logger.LogWarning(verifyException, "Unable to verify new image cleanup safety for {OptionId}", optionId); }
            token.ThrowIfCancellationRequested();
            return new(503, "image_update_failed", "Unable to update the option. Reload before trying again.");
        }
        finally
        {
            if (!committed && cleanupSafe) await storage.DeleteImportedImageAsync(uploaded);
        }
    }

    private static ImageRecoveryResult Conflict() =>
        new(409, "option_conflict", "This option changed. Reload it before trying again.");
}
