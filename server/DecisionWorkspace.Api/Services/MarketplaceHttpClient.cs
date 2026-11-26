using System.Net;

namespace DecisionWorkspace.Api.Services;

public static class MarketplaceHttpClient
{
    public static IHttpClientBuilder AddMarketplaceHttpClient(this IServiceCollection services) =>
        services.AddHttpClient("Marketplace", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("DecisionWorkspace/1.0");
            client.DefaultRequestHeaders.Accept.ParseAdd("*/*");
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
            // Factory-pooled handlers must not retain marketplace cookies across previews.
            UseCookies = false
        });
}
