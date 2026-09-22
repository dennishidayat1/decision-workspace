using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Data;

namespace DecisionWorkspace.Api.Services;

public class DecisionService
{
    private readonly AppDbContext _dbContext;

    public DecisionService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }
    public async Task<Decision> CreateAsync(CreateDecisionRequest request)
    {
        var now = DateTimeOffset.UtcNow;
        var decision = new Decision
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Question = request.Question,
            Context = request.Context,
            Category = request.Category,
            Status = "draft",
            CreatedAt = now,
            UpdatedAt = now,
        };

        _dbContext.Decisions.Add(decision);
        await _dbContext.SaveChangesAsync();

        return decision;
    }
}