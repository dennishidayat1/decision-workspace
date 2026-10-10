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

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration
            .GetConnectionString("DefaultConnection")
    );
});

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