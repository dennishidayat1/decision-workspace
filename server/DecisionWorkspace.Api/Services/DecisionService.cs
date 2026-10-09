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

    public async Task<Decision?> UpdateAsync(Guid id, CreateDecisionRequest request)
    {
        var decision = await _dbContext.Decisions
            .FirstOrDefaultAsync(d => d.Id == id);

        if (decision == null)
        {
            return null;
        }

        decision.Title = request.Title;
        decision.Question = request.Question;
        decision.Context = request.Context;
        decision.Category = request.Category;
        decision.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync();

        return decision;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var decision =
            await _dbContext.Decisions
                .FirstOrDefaultAsync(
                    d => d.Id == id
                );

        if (decision == null)
        {
            return false;
        }

        _dbContext.Decisions.Remove(
            decision
        );

        await _dbContext.SaveChangesAsync();

        return true;
    }
}