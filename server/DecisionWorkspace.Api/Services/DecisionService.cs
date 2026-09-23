using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Data;
using Microsoft.EntityFrameworkCore;

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

    public async Task<List<Decision>> GetAllAsync()
    {
        return await _dbContext.Decisions
        .OrderByDescending(d => d.CreatedAt)
        .ToListAsync();
    }

    public async Task<Decision?> GetByIdAsync(Guid id)
    {
        return await _dbContext.Decisions
            .FirstOrDefaultAsync(d => d.Id == id);
    }
}