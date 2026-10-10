using Microsoft.EntityFrameworkCore;
using DecisionWorkspace.Api.Models;

namespace DecisionWorkspace.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options
    ) : base(options)
    {
    }

    public DbSet<Decision> Decisions { get; set; }
    public DbSet<DecisionOption> DecisionOptions { get; set; }
    public DbSet<DecisionOptionAttribute> DecisionOptionAttributes { get; set; }
    public DbSet<Criterion> Criteria { get; set; }
    public DbSet<OptionScore> OptionScores { get; set; }

    protected override void OnModelCreating(
        ModelBuilder modelBuilder
    )
    {
        modelBuilder.Entity<Decision>()
            .HasIndex(decision => decision.UserId);


        modelBuilder.Entity<Criterion>()
            .HasOne(criterion => criterion.Decision)
            .WithMany()
            .HasForeignKey(criterion => criterion.DecisionId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<DecisionOption>()
            .HasOne(option => option.Decision)
            .WithMany()
            .HasForeignKey(option => option.DecisionId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<DecisionOptionAttribute>()
            .HasOne(attribute => attribute.DecisionOption)
            .WithMany()
            .HasForeignKey(attribute =>
                attribute.DecisionOptionId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<OptionScore>()
            .HasKey(optionScore => new
            {
                optionScore.DecisionOptionId,
                optionScore.CriterionId
            });


        modelBuilder.Entity<OptionScore>()
            .HasOne(optionScore => optionScore.Criterion)
            .WithMany()
            .HasForeignKey(optionScore =>
                optionScore.CriterionId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<OptionScore>()
            .HasOne(optionScore =>
                optionScore.DecisionOption)
            .WithMany()
            .HasForeignKey(optionScore =>
                optionScore.DecisionOptionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}