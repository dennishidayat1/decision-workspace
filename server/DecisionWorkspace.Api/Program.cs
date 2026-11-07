using DecisionWorkspace.Api.Services;
using DecisionWorkspace.Api.Data;
using Microsoft.EntityFrameworkCore;
using DecisionOptionWorkspace.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var frontendUrl =
    builder.Configuration["FrontendUrl"]
    ?? "http://localhost:4200";

var supabaseUrl =
    builder.Configuration["Supabase:Url"]
    ?? throw new InvalidOperationException(
        "Supabase URL is not configured."
    );

var supabaseServiceRoleKey =
    builder.Configuration["Supabase:ServiceRoleKey"]
    ?? throw new InvalidOperationException(
        "Supabase service role key is not configured."
    );

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(frontendUrl)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.Authority =
            $"{supabaseUrl}/auth/v1";

        options.Audience =
            "authenticated";

        options.RequireHttpsMetadata = true;
        options.MapInboundClaims = false;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
            };
    });

builder.Services.AddScoped<DecisionService>();
builder.Services.AddScoped<DecisionOptionService>();
builder.Services.AddScoped<DecisionOptionAttributeService>();
builder.Services.AddScoped<CriterionService>();
builder.Services.AddScoped<OptionScoreService>();
builder.Services.AddScoped<MarketplaceLinkService>();
builder.Services.AddScoped<MarketplaceImageStorageService>();
builder.Services.AddScoped<IOptionImageRepository, OptionImageRepository>();
builder.Services.AddScoped<OptionImageRecoveryService>();

builder.Services.AddHttpClient(
    "Marketplace",
    client =>
    {
        client.Timeout = TimeSpan.FromSeconds(10);

        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "DecisionWorkspace/1.0"
        );
    }
)
.ConfigurePrimaryHttpMessageHandler(() =>
    new HttpClientHandler
    {
        AllowAutoRedirect = false
    }
);

builder.Services.AddHttpClient(
    "SupabaseStorage",
    client =>
    {
        client.BaseAddress =
            new Uri($"{supabaseUrl}/storage/v1/");

        client.DefaultRequestHeaders.Add(
            "apikey",
            supabaseServiceRoleKey
        );

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                supabaseServiceRoleKey
            );
    }
);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration
            .GetConnectionString("DefaultConnection")
    );
});

var port =
    Environment.GetEnvironmentVariable("PORT");

if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls(
        $"http://0.0.0.0:{port}"
    );
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet(
    "/health",
    () => Results.Ok(
        new
        {
            status = "ok"
        }
    )
);

app.Run();
