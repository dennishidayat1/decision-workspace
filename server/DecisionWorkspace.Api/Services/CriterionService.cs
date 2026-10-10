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

    public async Task<Criterion?> CreateCriterionAsync(
        Guid userId,
        Guid decisionId,
        CreateCriterionRequest request
    )
    {
        if (!await DecisionExistsAsync(userId, decisionId))
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;

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

    private async Task<bool> DecisionExistsAsync(
        Guid userId,
        Guid decisionId
    )
    {
        return await _dbContext.Decisions
            .AnyAsync(decision =>
                decision.Id == decisionId &&
                decision.UserId == userId
            );
    }

    public async Task<List<Criterion>?> GetByDecisionIdAsync(
        Guid userId,
        Guid decisionId
    )
    {
        if (!await DecisionExistsAsync(userId, decisionId))
        {
            return null;
        }

        return await _dbContext.Criteria
            .Where(criterion =>
                criterion.DecisionId == decisionId &&
                criterion.Decision.UserId == userId
            )
            .ToListAsync();
    }

    public async Task<Criterion?> UpdateCriterionAsync(
        Guid userId,
        Guid decisionId,
        Guid criterionId,
        CreateCriterionRequest request
    )
    {
        var criterion = await _dbContext.Criteria
            .FirstOrDefaultAsync(criterion =>
                criterion.Id == criterionId &&
                criterion.DecisionId == decisionId &&
                criterion.Decision.UserId == userId
            );

        if (criterion == null)
        {
            return null;
        }

        criterion.Name = request.Name;
        criterion.Importance = request.Importance;
        criterion.Context = request.Context;
        criterion.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync();

        return criterion;
    }

    public async Task<bool> DeleteCriterionAsync(
        Guid userId,
        Guid decisionId,
        Guid criterionId
    )
    {
        var criterion = await _dbContext.Criteria
            .FirstOrDefaultAsync(criterion =>
                criterion.Id == criterionId &&
                criterion.DecisionId == decisionId &&
                criterion.Decision.UserId == userId
            );

        if (criterion == null)
        {
            return false;
        }

        _dbContext.Criteria.Remove(criterion);
        await _dbContext.SaveChangesAsync();

        return true;
    }
}