using System.Net;
using System.Net.Http.Headers;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;

internal static class RecoveryTests
{
    private const string Cdn = "https://p16-images-sign-sg.tokopedia-static.net/fresh.jpg";

    public static async Task RunAsync()
    {
        await Scenario("Ownership prevents any external work", async h =>
        {
            var result = await h.Refresh(userId: Guid.NewGuid());
            Check(result.Status == 404 && h.HttpCalls == 0 && h.Repository.Writes == 0);
        });
        await Scenario("Missing source preserves the option", async h =>
        {
            h.Repository.Option.SourceUrl = null;
            Check((await h.Refresh()).Code == "source_url_missing" && h.HttpCalls == 0);
        });
        await Scenario("Unsupported source preserves the option", async h =>
        {
            h.Repository.Option.SourceUrl = "https://tokopedia.com.evil.test/product";
            Check((await h.Refresh()).Code == "source_url_unsupported" && h.HttpCalls == 0);
        });
        await Scenario("Stale request rejects before HTTP", async h =>
        {
            Check((await h.Refresh(expected: h.Repository.Option.UpdatedAt.AddSeconds(-1))).Code == "option_conflict");
            Check(h.HttpCalls == 0);
        });
        await Scenario("Custom thumbnail requires confirmation", async h =>
        {
            h.Repository.Option.ThumbnailUrl = "https://user.example/custom.jpg";
            Check((await h.Refresh()).Code == "thumbnail_confirmation_required" && h.HttpCalls == 0);
            Check((await h.Refresh(replace: true)).Status == 200);
        });
        await Scenario("Missing image metadata never uploads", async h =>
        {
            h.Html = "<html>No product metadata</html>";
            Check((await h.Refresh()).Code == "metadata_image_missing" && h.Uploads == 0);
        });
        await Scenario("Invalid metadata image never uploads", async h =>
        {
            h.Html = "<meta property='og:image' content='http://unsafe.example/image.jpg'>";
            Check((await h.Refresh()).Code == "metadata_image_missing" && h.Uploads == 0);
        });
        await Scenario("Metadata network failure has a stable error", async h =>
        {
            h.FailMetadata = true;
            Check((await h.Refresh()).Code == "metadata_fetch_failed" && h.Uploads == 0);
        });
        await Scenario("Expired image is replaced from fresh metadata; unrelated values preserved", async h =>
        {
            var before = h.UnrelatedValues();
            var originalVersion = h.Repository.Option.UpdatedAt;
            var result = await h.Refresh();
            Check(result.Status == 200 && result.Option!.ImageUrl == h.UploadedUrl);
            Check(result.Option!.ThumbnailUrl == h.UploadedUrl && result.Option.UpdatedAt > originalVersion);
            Check(h.UnrelatedValues() == before && h.Deletes == 0 && h.Uploads == 1);
        });
        await Scenario("JSON-LD metadata is reused", async h =>
        {
            h.Html = "<script type='application/ld+json'>{\"@type\":\"Product\",\"image\":\"" + Cdn + "\"}</script>";
            Check((await h.Refresh()).Status == 200);
        });
        await Scenario("Upload failure preserves both old image fields", async h =>
        {
            h.FailUpload = true;
            var old = h.Repository.Option.ImageUrl;
            Check((await h.Refresh()).Code == "image_storage_failed");
            Check(h.Repository.Writes == 0 && h.Repository.Option.ImageUrl == old && h.Repository.Option.ThumbnailUrl == old);
        });
        await Scenario("Download failure never becomes successful CDN fallback", async h =>
        {
            h.FailDownload = true;
            Check((await h.Refresh()).Code == "image_storage_failed" && h.Uploads == 0 && h.Repository.Writes == 0);
        });
        await Scenario("Concurrent write rejects at commit and cleans only new object", async h =>
        {
            h.Repository.ConflictAtCommit = true;
            var result = await h.Refresh();
            Check(result.Code == "option_conflict" && h.Repository.Writes == 1 && h.Deletes == 1);
            Check(h.DeletedPath == h.UploadedPath);
        });
        await Scenario("Database failure cleans new unreferenced object", async h =>
        {
            h.Repository.FailWrite = true;
            Check((await h.Refresh()).Code == "image_update_failed" && h.Deletes == 1);
        });
        await Scenario("Lost commit acknowledgement does not delete referenced object", async h =>
        {
            h.Repository.CommitThenThrow = true;
            Check((await h.Refresh()).Code == "image_update_failed" && h.Deletes == 0);
        });
        await Scenario("Unavailable verification retains object rather than deleting a potentially referenced image", async h =>
        {
            h.Repository.FailWrite = true;
            h.Repository.FailVerification = true;
            Check((await h.Refresh()).Code == "image_update_failed" && h.Deletes == 0);
        });
        await Scenario("Cleanup failure does not hide conflict", async h =>
        {
            h.Repository.ConflictAtCommit = true;
            h.FailCleanup = true;
            Check((await h.Refresh()).Code == "option_conflict" && h.Deletes == 1);
        });
        await Scenario("Cleanup rejects unrelated storage and old external objects", async h =>
        {
            await h.Storage.DeleteImportedImageAsync("https://other.supabase.co/storage/v1/object/public/marketplace-images/imports/" + Guid.NewGuid().ToString("N") + ".jpg");
            await h.Storage.DeleteImportedImageAsync(Cdn);
            Check(h.Deletes == 0);
        });
    }

    private static void Check(bool value) { if (!value) throw new Exception("Recovery assertion failed"); }
    private static async Task Scenario(string name, Func<Harness, Task> run)
    {
        await run(new Harness());
        Console.WriteLine($"PASS {name}");
    }

    private sealed class Harness
    {
        public readonly MemoryRepository Repository = new();
        public readonly MarketplaceImageStorageService Storage;
        private readonly OptionImageRecoveryService recovery;
        public string Html = $"<meta property='og:image' content='{Cdn}'>";
        public bool FailMetadata, FailUpload, FailDownload, FailCleanup;
        public int HttpCalls, Uploads, Deletes;
        public string? UploadedPath, DeletedPath;
        public string? UploadedUrl => UploadedPath == null ? null : "https://example.supabase.co/storage/v1/object/public/" + UploadedPath;

        public Harness()
        {
            var factory = new FakeFactory((name, request, _) =>
            {
                HttpCalls++;
                if (name == "SupabaseStorage")
                {
                    var objectPath = request.RequestUri!.AbsolutePath["/storage/v1/object/".Length..];
                    if (request.Method == HttpMethod.Delete)
                    {
                        Deletes++;
                        DeletedPath = objectPath;
                        if (FailCleanup) throw new HttpRequestException("Mock cleanup failure");
                    }
                    else { Uploads++; UploadedPath = objectPath; }
                    return Task.FromResult(new HttpResponseMessage(FailUpload ? HttpStatusCode.Forbidden : HttpStatusCode.OK));
                }
                if (request.RequestUri!.Host.EndsWith("tokopedia-static.net"))
                {
                    Check(request.RequestUri.ToString() == Cdn); // Never download the expired saved URL.
                    var response = new HttpResponseMessage(FailDownload ? HttpStatusCode.Forbidden : HttpStatusCode.OK)
                    { Content = new ByteArrayContent([1, 2, 3]) };
                    response.Content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                    return Task.FromResult(response);
                }
                if (FailMetadata) throw new HttpRequestException("Mock metadata failure");
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Html) });
            });
            Storage = new MarketplaceImageStorageService(factory,
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                    { ["Supabase:Url"] = "https://example.supabase.co" }).Build(),
                NullLogger<MarketplaceImageStorageService>.Instance);
            recovery = new OptionImageRecoveryService(Repository, new MarketplaceLinkService(factory, NullLogger<MarketplaceLinkService>.Instance), Storage,
                NullLogger<OptionImageRecoveryService>.Instance);
        }

        public Task<ImageRecoveryResult> Refresh(bool replace = false, Guid? userId = null, DateTimeOffset? expected = null) =>
            recovery.RefreshAsync(userId ?? Repository.Owner, Repository.Option.DecisionId, Repository.Option.Id,
                new RefreshOptionImageRequest { ExpectedUpdatedAt = expected ?? Repository.Option.UpdatedAt, ReplaceThumbnail = replace }, default);

        public string UnrelatedValues() => System.Text.Json.JsonSerializer.Serialize(new
        {
            Repository.Option.Id, Repository.Option.DecisionId, Repository.Option.Title,
            Repository.Option.Description, Repository.Option.Price, Repository.Option.Currency,
            Repository.Option.Url, Repository.Option.SourceUrl, Repository.Option.SourceName, Repository.Option.CreatedAt
        });
    }

    private sealed class MemoryRepository : IOptionImageRepository
    {
        public readonly Guid Owner = Guid.NewGuid();
        public DecisionOption Option = new()
        {
            Id = Guid.NewGuid(), DecisionId = Guid.NewGuid(), Title = "Original title", Description = "Original description",
            Price = 123, Currency = "IDR", SourceName = "Tokopedia", SourceUrl = "https://www.tokopedia.com/shop/product",
            Url = "https://www.tokopedia.com/shop/product?selected=variant", CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1), ImageUrl = Cdn + "?expired=1", ThumbnailUrl = Cdn + "?expired=1"
        };
        public bool ConflictAtCommit, FailWrite, CommitThenThrow, FailVerification;
        public int Writes;
        public Task<DecisionOption?> FindOwnedAsync(Guid userId, Guid decisionId, Guid optionId, CancellationToken token)
        {
            if (FailVerification && Writes > 0) throw new IOException("Mock unavailable verification");
            if (userId != Owner || decisionId != Option.DecisionId || optionId != Option.Id)
                return Task.FromResult<DecisionOption?>(null);
            // Detached snapshot, like AsNoTracking in the production repository.
            return Task.FromResult<DecisionOption?>(System.Text.Json.JsonSerializer.Deserialize<DecisionOption>(
                System.Text.Json.JsonSerializer.Serialize(Option))!);
        }
        public Task<bool> TrySetImageAsync(Guid userId, DecisionOption snapshot, string url, DateTimeOffset updatedAt, CancellationToken token)
        {
            Writes++;
            if (ConflictAtCommit) Option.UpdatedAt = Option.UpdatedAt.AddSeconds(1);
            if (FailWrite) throw new IOException("Mock database failure");
            if (userId != Owner || Option.UpdatedAt != snapshot.UpdatedAt) return Task.FromResult(false);
            Option.ImageUrl = url;
            Option.ThumbnailUrl = url;
            Option.UpdatedAt = updatedAt;
            if (CommitThenThrow) throw new IOException("Mock lost commit acknowledgement");
            return Task.FromResult(true);
        }
    }
}
