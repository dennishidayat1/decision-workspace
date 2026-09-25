using DecisionWorkspace.Api.Data;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DecisionWorkspace.Api.Services;

public class CriterionService
{
    private readonly AppDbContext _dbContext;

    public CriterionService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Criterion?> CreateCriterionAsync(Guid decisionId, CreateCriterionRequest request)
    {
        if (!await DecisionExistsAsync(decisionId))
        {
            return null;
        }

        var now  = DateTimeOffset.UtcNow;
        var criterion = new Criterion
        {
            Id = Guid.NewGuid(),
            DecisionId = decisionId,
            Name = request.Name,
            Importance = request.Importance,
            Context = request.Context,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Criteria.Add(criterion);
        await _dbContext.SaveChangesAsync();

        return criterion;
    }

    private async Task<bool> DecisionExistsAsync(Guid decisionId)
    {
        return await _dbContext.Decisions.AnyAsync(decision => decision.Id == decisionId);
    }

    public async Task<List<Criterion>?> GetByDecisionIdAsync(Guid decisionId)
    {
        if (!await DecisionExistsAsync(decisionId))
        {
            return null;
        }

        return await _dbContext.Criteria
            .Where(criterion => criterion.DecisionId == decisionId)
            .ToListAsync();
    }
}