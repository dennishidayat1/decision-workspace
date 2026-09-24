using Microsoft.EntityFrameworkCore;
using DecisionWorkspace.Api.Models;

namespace DecisionWorkspace.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
    : base(options)
    {
    }

    public DbSet<Decision> Decisions { get; set; }
    public DbSet<DecisionOption> DecisionOptions { get; set; }
}