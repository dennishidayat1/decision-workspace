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
    public DbSet<DecisionOptionAttribute> DecisionOptionAttributes { get; set; }
    public DbSet<Criterion> Criteria { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OptionScore>()
            .HasKey(optionScore => new
            {
                optionScore.DecisionOptionId,
                optionScore.CriterionId
            });
    }

    public DbSet<OptionScore> OptionScores { get; set; }
}