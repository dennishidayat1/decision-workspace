using DecisionWorkspace.Api.Data;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace DecisionWorkspace.Api.Services;

public class OptionScoreService
{
    private readonly AppDbContext _dbContext;

    public OptionScoreService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<OptionScore?> CreateOptionScoreAsync(
        Guid userId,
        Guid decisionOptionId,
        CreateOptionScoreRequest request
    )
    {
        var decisionOption =
            await _dbContext.DecisionOptions
                .FirstOrDefaultAsync(option =>
                    option.Id == decisionOptionId &&
                    option.Decision.UserId == userId
                );

        if (decisionOption == null)
        {
            return null;
        }

        var criterion =
            await _dbContext.Criteria
                .FirstOrDefaultAsync(criterion =>
                    criterion.Id == request.CriterionId &&
                    criterion.DecisionId == decisionOption.DecisionId &&
                    criterion.Decision.UserId == userId
                );

        if (criterion == null)
        {
            return null;
        }

        var existingScore =
            await _dbContext.OptionScores
                .FirstOrDefaultAsync(optionScore =>
                    optionScore.DecisionOptionId == decisionOptionId &&
                    optionScore.CriterionId == request.CriterionId &&
                    optionScore.DecisionOption.Decision.UserId == userId
                );

        if (existingScore != null)
        {
            existingScore.Score = request.Score;
            existingScore.Comment = request.Comment;
            existingScore.UpdatedAt = DateTimeOffset.UtcNow;

            await _dbContext.SaveChangesAsync();

            return existingScore;
        }

        var now = DateTimeOffset.UtcNow;

        var newScore = new OptionScore
        {
            DecisionOptionId = decisionOptionId,
            CriterionId = request.CriterionId,
            Score = request.Score,
            Comment = request.Comment,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.OptionScores.Add(newScore);
        await _dbContext.SaveChangesAsync();

        return newScore;
    }

    public async Task<List<OptionScore>?> GetByDecisionOptionIdAsync(
        Guid userId,
        Guid decisionOptionId
    )
    {
        var optionExists =
            await _dbContext.DecisionOptions
                .AnyAsync(option =>
                    option.Id == decisionOptionId &&
                    option.Decision.UserId == userId
                );

        if (!optionExists)
        {
            return null;
        }

        return await _dbContext.OptionScores
            .Where(optionScore =>
                optionScore.DecisionOptionId == decisionOptionId &&
                optionScore.DecisionOption.Decision.UserId == userId
            )
            .ToListAsync();
    }
}