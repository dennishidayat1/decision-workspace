global using Microsoft.AspNetCore.Http;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Http.Headers;
using DecisionWorkspace.Api.Controllers;
using DecisionWorkspace.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

// Dependency-free regression runner. All HTTP is mocked; no server, CDN or storage is contacted.
const string ImageUrl = "https://p16-images-sign-sg.tokopedia-static.net/image.jpg";
var tests = new List<(string Name, Func<Task> Run)>();
tests.Add(("Marketplace preview timeout paths", PreviewTests.RunAsync));
tests.Add(("Explicit image recovery scenarios", RecoveryTests.RunAsync));
tests.Add(("Production atomic database commands without network", DatabaseCommandTests.RunAsync));
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
HttpResponseMessage Image(HttpContent? content = null)
{
    var response = new HttpResponseMessage(HttpStatusCode.OK)
    { Content = content ?? new ByteArrayContent([1, 2, 3]) };
    response.Content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
    return response;
}
MarketplaceImageStorageService Storage(FakeFactory factory) => new(factory,
    new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["Supabase:Url"] = "https://example.supabase.co" }).Build(),
    NullLogger<MarketplaceImageStorageService>.Instance);
MarketplaceImageController Proxy(FakeFactory factory) => new(factory,
    NullLogger<MarketplaceImageController>.Instance)
    { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

tests.Add(("Supported marketplace URLs and JSON-LD product images remain available", () =>
{
    var service = new MarketplaceLinkService(new FakeFactory((_, _, _) => throw new Exception("No HTTP expected")), NullLogger<MarketplaceLinkService>.Instance);
    foreach (var source in new[] { "https://shopee.co.id/product/123/456", "https://shp.ee/example", "https://www.tokopedia.com/shop/product" })
        Check(service.TryDetectMarketplace(source, out _, out _), "Supported marketplace detection changed");
    var metadata = service.ExtractProductJsonLd("<script type='application/ld+json'>{\"@type\":\"Product\",\"image\":\"https://example.test/product.jpg\"}</script>");
    Check(metadata?.ImageUrl == "https://example.test/product.jpg", "Product image extraction changed");
    return Task.CompletedTask;
}));

tests.Add(("Proxy errors are empty results, not client-error results", async () =>
{
    var proxy = Proxy(new FakeFactory((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden))));
    var result = await proxy.GetImage(ImageUrl, default);
    Check(result is EmptyResult, "Failure must bypass MVC ProblemDetails mapping");
    Check(proxy.Response.StatusCode == 404, "Failure status");
    Check(proxy.Response.ContentType == null, "Failure must not advertise JSON");
}));
tests.Add(("Proxy rejects invalid hosts without HTTP", async () =>
{
    var factory = new FakeFactory((_, _, _) => throw new Exception("HTTP must not run"));
    Check(await Proxy(factory).GetImage("https://example.com/image.jpg", default) is EmptyResult, "Invalid URL");
    Check(await Proxy(factory).GetImage(null, default) is EmptyResult, "Missing URL");
}));
tests.Add(("Proxy success retains image bytes, MIME and caching", async () =>
{
    var proxy = Proxy(new FakeFactory((_, _, _) => Task.FromResult(Image())));
    var result = await proxy.GetImage(ImageUrl, default) as FileContentResult;
    Check(result?.ContentType == "image/jpeg" && result.FileContents.SequenceEqual(new byte[] { 1, 2, 3 }), "Image changed");
    Check(proxy.Response.Headers.CacheControl == "public,max-age=1800", "Caching changed");
}));
tests.Add(("Proxy enforces the streaming limit without Content-Length", async () =>
{
    using var stream = new MemoryStream(new byte[16 * 1024 * 1024]);
    var content = new UnboundedContent(stream);
    var proxy = Proxy(new FakeFactory((_, _, _) => Task.FromResult(Image(content))));
    Check(await proxy.GetImage(ImageUrl, default) is EmptyResult, "Oversized proxy image must be rejected");
    Check(proxy.Response.StatusCode == 404, "Oversized proxy status");
    Check(content.BytesRead <= 8 * 1024 * 1024 + 81920, "Proxy read past bounded lookahead");
}));
foreach (var status in new[] { HttpStatusCode.Forbidden, HttpStatusCode.Redirect })
    tests.Add(($"Download {status} skips upload", async () =>
    {
        var factory = new FakeFactory((name, _, _) =>
        {
            Check(name == "Marketplace", "Must not upload rejected download");
            return Task.FromResult(new HttpResponseMessage(status));
        });
        Check(await Storage(factory).ImportImageAsync(ImageUrl) == null, "Expected fallback");
    }));
tests.Add(("Download HTML skips upload", async () =>
{
    var factory = new FakeFactory((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        { Content = new StringContent("Access denied") }));
    Check(await Storage(factory).ImportImageAsync(ImageUrl) == null, "HTML is not an image");
}));
tests.Add(("Chunked oversized body stops at the streaming limit", async () =>
{
    using var stream = new MemoryStream(new byte[16 * 1024 * 1024]);
    var factory = new FakeFactory((name, _, _) =>
    {
        Check(name == "Marketplace", "Oversized download must not upload");
        return Task.FromResult(Image(new StreamContent(stream)));
    });
    // Hide Content-Length, as with a chunked upstream response.
    var content = new UnboundedContent(stream);
    factory.Send = (_, _, _) => Task.FromResult(Image(content));
    Check(await Storage(factory).ImportImageAsync(ImageUrl) == null, "Oversized fallback");
    Check(content.BytesRead <= 8 * 1024 * 1024 + 81920, "Read beyond bounded lookahead");
}));
tests.Add(("Exactly 8 MiB uploads and returns a public URL", async () =>
{
    var uploaded = false;
    var factory = new FakeFactory(async (name, request, token) =>
    {
        if (name == "Marketplace") return Image(new ByteArrayContent(new byte[8 * 1024 * 1024]));
        uploaded = true;
        Check(request.Method == HttpMethod.Post, "Upload verb");
        Check(request.RequestUri!.AbsolutePath.StartsWith("/storage/v1/object/marketplace-images/imports/"), "Bucket path");
        Check((await request.Content!.ReadAsByteArrayAsync(token)).Length == 8 * 1024 * 1024, "Upload bytes");
        return new HttpResponseMessage(HttpStatusCode.OK);
    });
    var result = await Storage(factory).ImportImageAsync(ImageUrl);
    Check(uploaded && result!.StartsWith("https://example.supabase.co/storage/v1/object/public/marketplace-images/imports/"), "Public URL");
}));
foreach (var failure in new Exception[] { new HttpRequestException(), new IOException(), new TaskCanceledException() })
    tests.Add(($"Expected {failure.GetType().Name} falls back", async () =>
    {
        Check(await Storage(new FakeFactory((_, _, _) => throw failure)).ImportImageAsync(ImageUrl) == null, "Exception escaped");
    }));
tests.Add(("Storage rejection and storage network failure fall back", async () =>
{
    foreach (var throws in new[] { false, true })
    {
        var factory = new FakeFactory((name, _, _) => name == "Marketplace" ? Task.FromResult(Image()) :
            throws ? throw new HttpRequestException() : Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)));
        Check(await Storage(factory).ImportImageAsync(ImageUrl) == null, "Storage failure escaped");
    }
}));
tests.Add(("Caller cancellation propagates", async () =>
{
    using var cancellation = new CancellationTokenSource();
    cancellation.Cancel();
    try
    {
        await Storage(new FakeFactory((_, _, token) => Task.FromCanceled<HttpResponseMessage>(token)))
            .ImportImageAsync(ImageUrl, cancellation.Token);
        throw new Exception("Cancellation swallowed");
    }
    catch (OperationCanceledException) { }
}));
tests.Add(("Download deadline cancels a stalled image body after headers", async () =>
{
    var started = System.Diagnostics.Stopwatch.StartNew();
    var factory = new FakeFactory((_, _, _) =>
        Task.FromResult(Image(new UnboundedContent(new StalledStream()))));
    Check(await Storage(factory).ImportImageAsync(ImageUrl) == null, "Timeout must fall back");
    Check(started.Elapsed < TimeSpan.FromSeconds(15), "Download deadline exceeded");
}));

foreach (var test in tests)
{
    await test.Run();
    Console.WriteLine($"PASS {test.Name}");
}
Console.WriteLine($"{tests.Count} image regression checks passed.");

sealed class FakeFactory(Func<string, HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : IHttpClientFactory
{
    public Func<string, HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Send = send;
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(100);
    public HttpClient CreateClient(string name) => new(new Handler((request, token) => Send(name, request, token)))
        { BaseAddress = new Uri("https://example.supabase.co/storage/v1/"), Timeout = Timeout };
    private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) => send(request, token);
    }
}
sealed class UnboundedContent(Stream source) : HttpContent
{
    public long BytesRead { get; private set; }
    protected override bool TryComputeLength(out long length) { length = 0; return false; }
    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => throw new NotSupportedException();
    protected override Task<Stream> CreateContentReadStreamAsync() => Task.FromResult<Stream>(new CountingStream(source, n => BytesRead += n));
    protected override Task<Stream> CreateContentReadStreamAsync(CancellationToken token) => CreateContentReadStreamAsync();
    private sealed class CountingStream(Stream source, Action<int> count) : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int size) { var n = source.Read(buffer, offset, size); count(n); return n; }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken token = default)
        { var n = await source.ReadAsync(buffer, token); count(n); return n; }
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long length) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
sealed class StalledStream : MemoryStream
{
    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken token = default)
    {
        await Task.Delay(Timeout.InfiniteTimeSpan, token);
        return 0;
    }
}
