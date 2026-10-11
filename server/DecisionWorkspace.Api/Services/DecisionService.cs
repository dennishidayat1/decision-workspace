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

    public async Task<DecisionWorkspaceResponse?> GetWorkspaceAsync(
        Guid userId,
        Guid decisionId
    )
    {
        var decision = await _dbContext.Decisions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                d =>
                    d.Id == decisionId &&
                    d.UserId == userId
            );

        if (decision == null)
        {
            return null;
        }

        var criteria = await _dbContext.Criteria
            .AsNoTracking()
            .Where(
                criterion =>
                    criterion.DecisionId == decisionId
            )
            .ToListAsync();

        var options = await _dbContext.DecisionOptions
            .AsNoTracking()
            .Where(
                option =>
                    option.DecisionId == decisionId
            )
            .ToListAsync();

        var optionIds = options
            .Select(option => option.Id)
            .ToList();

        var attributes =
            optionIds.Count == 0
                ? []
                : await _dbContext.DecisionOptionAttributes
                    .AsNoTracking()
                    .Where(
                        attribute =>
                            optionIds.Contains(
                                attribute.DecisionOptionId
                            )
                    )
                    .ToListAsync();

        var scores =
            optionIds.Count == 0
                ? []
                : await _dbContext.OptionScores
                    .AsNoTracking()
                    .Where(
                        score =>
                            optionIds.Contains(
                                score.DecisionOptionId
                            )
                    )
                    .ToListAsync();

        return new DecisionWorkspaceResponse
        {
            Decision = decision,
            Criteria = criteria,
            Options = options,
            Attributes = attributes,
            Scores = scores,
        };
    }

    public async Task<Decision> CreateWorkspaceAsync(
        Guid userId,
        CreateDecisionWorkspaceRequest request
    )
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            var now = DateTimeOffset.UtcNow;

            var decision = new Decision
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = request.Title,
                Question = request.Question,
                Context = request.Context,
                Category = request.Category,
                Status = "draft",
                CreatedAt = now,
                UpdatedAt = now,
            };

            _dbContext.Decisions.Add(decision);

            var criteria = request.Criteria
                .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                .Select(c => new Criterion
                {
                    Id = Guid.NewGuid(),
                    DecisionId = decision.Id,
                    Name = c.Name,
                    Importance = c.Importance,
                    Context = c.Context,
                })
                .ToList();

            if (criteria.Count > 0)
            {
                _dbContext.Criteria.AddRange(criteria);
            }

            await _dbContext.SaveChangesAsync();

            await transaction.CommitAsync();

            return decision;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<Decision> CreateAsync(
        Guid userId,
        CreateDecisionRequest request
    )
    {
        var now = DateTimeOffset.UtcNow;

        var decision = new Decision
        {
            Id = Guid.NewGuid(),
            UserId = userId,
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

    public async Task<List<Decision>> GetAllAsync(Guid userId)
    {
        return await _dbContext.Decisions
            .Where(d => d.UserId == userId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync();
    }

    public async Task<Decision?> GetByIdAsync(
        Guid userId,
        Guid id
    )
    {
        return await _dbContext.Decisions
            .FirstOrDefaultAsync(
                d => d.Id == id &&
                     d.UserId == userId
            );
    }

    public async Task<Decision?> UpdateAsync(
        Guid userId,
        Guid id,
        CreateDecisionRequest request
    )
    {
        var decision = await _dbContext.Decisions
            .FirstOrDefaultAsync(
                d => d.Id == id &&
                     d.UserId == userId
            );

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

    public async Task<bool> DeleteAsync(
        Guid userId,
        Guid id
    )
    {
        var decision = await _dbContext.Decisions
            .FirstOrDefaultAsync(
                d => d.Id == id &&
                     d.UserId == userId
            );

        if (decision == null)
        {
            return false;
        }

        _dbContext.Decisions.Remove(decision);

        await _dbContext.SaveChangesAsync();

        return true;
    }
}