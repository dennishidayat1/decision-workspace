using System.Net;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Controllers;
using DecisionWorkspace.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

static class PreviewTests
{
    public static async Task RunAsync()
    {
        const string source = "https://www.tokopedia.com/shop/product";
        const string shortSource = "https://tk.tokopedia.com/ZSpuKfdyw/";
        const string image = "https://p16-images-sign-sg.tokopedia-static.net/image.jpg";
        var logs = new PreviewLogger();

        MarketplaceLinkService Service(FakeFactory factory) => new(factory, logs);
        MarketplaceLinksController Controller(FakeFactory factory)
        {
            var controller = new MarketplaceLinksController(
            Service(factory),
            new MarketplaceImageStorageService(factory,
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                { ["Supabase:Url"] = "https://example.supabase.co" }).Build(),
                NullLogger<MarketplaceImageStorageService>.Instance),
            NullLogger<MarketplaceLinksController>.Instance)
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
            controller.Request.Headers["Rndr-Id"] = "test-render-request";
            return controller;
        }

        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
        }

        // Both header stages remain independently diagnosable after removing the duplicate GET.
        foreach (var timeoutOnRequest in new[] { 1, 2 })
        {
            logs.Entries.Clear();
            var requests = 0;
            var factory = new FakeFactory((_, _, _) =>
            {
                if (++requests == timeoutOnRequest)
                    throw new TaskCanceledException("Simulated upstream timeout", new TimeoutException());
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
                { Headers = { Location = new Uri(source) } });
            });
            var result = await Controller(factory).Preview(new PreviewMarketplaceLinkRequest { Url = shortSource }, default);
            Check(result is ObjectResult { StatusCode: 504 }, "Metadata timeout must produce application HTTP 504");
            Check(requests == timeoutOnRequest, "Preview continued after metadata timeout");
            var entry = logs.Entries.Single(e => e.Level == LogLevel.Warning);
            Check((string)entry.Fields["Stage"]! == "response_headers" &&
                (string)entry.Fields["Host"]! == (timeoutOnRequest == 1 ? "tk.tokopedia.com" : "www.tokopedia.com") &&
                (int)entry.Fields["Hop"]! == timeoutOnRequest - 1 &&
                (long)entry.Fields["ElapsedMs"]! >= 0 &&
                (string)entry.Fields["RequestId"]! == "test-render-request" && entry.Exception != null,
                "Timeout log must identify stage, host, hop, elapsed time, request ID and exception");
            Console.WriteLine($"PASS Preview metadata request {timeoutOnRequest} timeout returns HTTP 504");
        }

        var pageRequests = 0;
        var imageRequests = 0;
        var fallbackFactory = new FakeFactory((name, request, _) =>
        {
            Check(name == "Marketplace", "Timed-out image must not be uploaded");
            if (request.RequestUri!.ToString() == image)
            {
                imageRequests++;
                throw new TaskCanceledException("Simulated image timeout", new TimeoutException());
            }
            Check(request.RequestUri.ToString() == source, "Unexpected metadata URL");
            pageRequests++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent($"<meta property='og:title' content='Product'><meta property='og:image' content='{image}'>")
            });
        });
        var preview = await Controller(fallbackFactory).Preview(new PreviewMarketplaceLinkRequest { Url = source }, default);
        Check(preview is OkObjectResult { Value: MarketplaceLinkPreviewResponse { Title: "Product", ImageUrl: image } },
            "Optional image timeout must preserve a successful metadata preview and source image");
        Check(pageRequests == 1 && imageRequests == 1, "Direct page must be fetched once before optional image import");
        Console.WriteLine("PASS Preview image timeout falls back after successful metadata fetch");

        var visited = new List<string>();
        var redirectFactory = new FakeFactory((_, request, _) =>
        {
            Check(request.Method == HttpMethod.Get, "Resolution must use GET");
            visited.Add(request.RequestUri!.ToString());
            return Task.FromResult(visited.Count == 1
                ? new HttpResponseMessage(HttpStatusCode.Redirect)
                {
                    Headers = { Location = new Uri(source) },
                    // A redirect body must never be downloaded.
                    Content = new UnboundedContent(new StalledStream())
                }
                : new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent("<script type='application/ld+json'>{\"@type\":\"Product\",\"name\":\"Jeans\",\"description\":\"Denim\",\"offers\":{\"price\":123,\"priceCurrency\":\"IDR\"}}</script>") });
        }) { Timeout = TimeSpan.FromSeconds(2) };
        var success = await Controller(redirectFactory).Preview(new PreviewMarketplaceLinkRequest { Url = shortSource }, default);
        Check(success is OkObjectResult { Value: MarketplaceLinkPreviewResponse
            { Title: "Jeans", Description: "Denim", Price: 123, Currency: "IDR", SourceName: "Tokopedia",
              SourceUrl: shortSource, CanonicalUrl: source } }, "Metadata and canonical URL must survive combined fetch");
        Check(visited.SequenceEqual(new[] { shortSource, source }), "Final page must not be requested twice");
        Console.WriteLine("PASS Short link uses exactly two GETs, ignores redirect body, and preserves metadata");

        logs.Entries.Clear();
        var stalledFactory = new FakeFactory((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        { Content = new StalledHtmlContent() })) { Timeout = TimeSpan.FromMilliseconds(100) };
        var bodyTimeout = await Controller(stalledFactory).Preview(new PreviewMarketplaceLinkRequest { Url = source }, default);
        Check(bodyTimeout is ObjectResult { StatusCode: 504 }, "Stalled HTML body must time out after headers");
        var bodyLog = logs.Entries.Single(e => e.Level == LogLevel.Warning);
        Check((string)bodyLog.Fields["Stage"]! == "html_body" && (long)bodyLog.Fields["ElapsedMs"]! >= 0,
            "Stalled HTML must be distinguished from headers timeout");
        Console.WriteLine("PASS HTML body deadline returns 504 and identifies html_body stage");

        using var cancellation = new CancellationTokenSource();
        var cancelledFactory = new FakeFactory((_, _, _) =>
        {
            cancellation.Cancel();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StalledHtmlContent() });
        });
        logs.Entries.Clear();
        try
        {
            await Controller(cancelledFactory).Preview(new PreviewMarketplaceLinkRequest { Url = source }, cancellation.Token);
            throw new Exception("Caller cancellation was swallowed");
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
        Check(!logs.Entries.Any(e => e.Level == LogLevel.Warning), "Caller cancellation must not be logged as upstream timeout");
        Console.WriteLine("PASS Caller cancellation propagates without becoming HTTP 500 or upstream timeout");

        foreach (var destination in new[] { "https://example.com/product", "http://www.tokopedia.com/product", "https://user@www.tokopedia.com/product" })
        {
            var sends = 0;
            var unsafeFactory = new FakeFactory((_, _, _) =>
            {
                sends++;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
                { Headers = { Location = new Uri(destination) } });
            });
            Check(await Service(unsafeFactory).GetPageAsync(new Uri(shortSource)) == null && sends == 1,
                "Unsafe redirect must be rejected before making another request");
        }
        var hops = 0;
        var loopFactory = new FakeFactory((_, _, _) =>
        {
            hops++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            { Headers = { Location = new Uri("/loop", UriKind.Relative) } });
        });
        Check(await Service(loopFactory).GetPageAsync(new Uri(source)) == null && hops == 6, "Redirect limit must remain bounded");
        var relativeSends = 0;
        var relativeFactory = new FakeFactory((_, request, _) => Task.FromResult(++relativeSends == 1
            ? new HttpResponseMessage(HttpStatusCode.Redirect) { Headers = { Location = new Uri("/final", UriKind.Relative) } }
            : new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(request.RequestUri!.AbsolutePath) }));
        var relativePage = await Service(relativeFactory).GetPageAsync(new Uri(source));
        Check(relativePage?.Uri.AbsolutePath == "/final" && relativePage?.Html == "/final" && relativeSends == 2,
            "Relative redirect must preserve final URL and HTML");
        Console.WriteLine("PASS Redirect safety, relative locations and hop limit remain enforced");

        foreach (var status in new[] { HttpStatusCode.Forbidden, HttpStatusCode.GatewayTimeout, HttpStatusCode.Redirect })
        {
            var rejected = new FakeFactory((_, _, _) => Task.FromResult(new HttpResponseMessage(status)));
            Check(await Controller(rejected).Preview(new PreviewMarketplaceLinkRequest { Url = source }, default)
                is BadRequestObjectResult, "Rejected status or missing redirect location must remain HTTP 400");
        }
        var unreachable = new FakeFactory((_, _, _) => throw new HttpRequestException("Simulated network failure"));
        Check(await Controller(unreachable).Preview(new PreviewMarketplaceLinkRequest { Url = source }, default)
            is ObjectResult { StatusCode: 502 }, "Network failure must remain HTTP 502");
        Console.WriteLine("PASS Upstream status rejection and network errors retain their existing response codes");
    }
}

sealed class PreviewLogger : ILogger<MarketplaceLinkService>
{
    public readonly List<(LogLevel Level, Dictionary<string, object?> Fields, Exception? Exception)> Entries = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter) =>
        Entries.Add((logLevel, ((IEnumerable<KeyValuePair<string, object?>>)state!).ToDictionary(p => p.Key, p => p.Value), exception));
}

sealed class StalledHtmlContent : HttpContent
{
    protected override bool TryComputeLength(out long length) { length = 0; return false; }
    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
        SerializeToStreamAsync(stream, context, CancellationToken.None);
    protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context, CancellationToken token) =>
        Task.Delay(Timeout.InfiniteTimeSpan, token);
}
