using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DecisionOptionWorkspace.Api.Services;

public class DecisionOptionService
{
    private readonly AppDbContext _dbContext;

    public DecisionOptionService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<CreateDecisionOptionResult> CreateAsync(
        Guid userId,
        Guid decisionId,
        CreateDecisionOptionRequest request
    )
    {
        if (!await DecisionExistsAsync(userId, decisionId))
        {
            return new CreateDecisionOptionResult
            {
                Status = CreateDecisionOptionStatus.DecisionNotFound
            };
        }

        var requestedCriterionIds = request.Scores
            .Select(score => score.CriterionId)
            .Distinct()
            .ToList();

        var validCriterionIds = await _dbContext.Criteria
            .Where(criterion =>
                criterion.DecisionId == decisionId &&
                criterion.Decision.UserId == userId &&
                requestedCriterionIds.Contains(criterion.Id))
            .Select(criterion => criterion.Id)
            .ToListAsync();

        if (validCriterionIds.Count != requestedCriterionIds.Count)
        {
            return new CreateDecisionOptionResult
            {
                Status = CreateDecisionOptionStatus.InvalidCriterion
            };
        }

        var now = DateTimeOffset.UtcNow;

        var decisionOption = new DecisionOption
        {
            Id = Guid.NewGuid(),
            DecisionId = decisionId,
            Title = request.Title,
            Url = request.Url,
            ThumbnailUrl = request.ThumbnailUrl,
            Description = request.Description,
            Price = request.Price,
            Currency = request.Currency,
            CreatedAt = now,
            UpdatedAt = now,

            SourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl)
            ? null
            : request.SourceUrl.Trim(),

            SourceName = string.IsNullOrWhiteSpace(request.SourceName)
            ? null
            : request.SourceName.Trim(),

            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl)
            ? null
            : request.ImageUrl.Trim(),
        };

        _dbContext.DecisionOptions.Add(decisionOption);

        var attributes = request.Attributes
            .Select(attribute => new DecisionOptionAttribute
            {
                Id = Guid.NewGuid(),
                DecisionOptionId = decisionOption.Id,
                Name = attribute.Name,
                Value = attribute.Value,
                CreatedAt = now,
                UpdatedAt = now,
            });

        _dbContext.DecisionOptionAttributes.AddRange(attributes);

        var scores = request.Scores
            .Select(score => new OptionScore
            {
                DecisionOptionId = decisionOption.Id,
                CriterionId = score.CriterionId,
                Score = score.Score,
                Comment = score.Comment,
                CreatedAt = now,
                UpdatedAt = now,
            });

        _dbContext.OptionScores.AddRange(scores);

        await _dbContext.SaveChangesAsync();

        return new CreateDecisionOptionResult
        {
            Status = CreateDecisionOptionStatus.Success,
            Option = decisionOption
        };
    }

    private async Task<bool> DecisionExistsAsync(
        Guid userId,
        Guid decisionId
    )
    {
        return await _dbContext.Decisions
            .AnyAsync(d =>
                d.Id == decisionId &&
                d.UserId == userId
            );
    }

    public async Task<List<DecisionOption>?> GetByDecisionIdAsync(
        Guid userId,
        Guid decisionId
    )
    {
        if (!await DecisionExistsAsync(userId, decisionId))
        {
            return null;
        }

        return await _dbContext.DecisionOptions
            .Where(option =>
                option.DecisionId == decisionId &&
                option.Decision.UserId == userId
            )
            .ToListAsync();
    }

    public async Task<DecisionOption?> UpdateAsync(
        Guid userId,
        Guid decisionId,
        Guid decisionOptionId,
        CreateDecisionOptionRequest request
    )
    {
        var decisionOption = await _dbContext.DecisionOptions.AsNoTracking()
            .FirstOrDefaultAsync(option =>
                option.Id == decisionOptionId &&
                option.DecisionId == decisionId &&
                option.Decision.UserId == userId
            );

        if (decisionOption == null)
        {
            return null;
        }

        if (request.ExpectedUpdatedAt == null || decisionOption.UpdatedAt != request.ExpectedUpdatedAt)
            throw new OptionConcurrencyException();

        var updatedAt = DateTimeOffset.UtcNow;
        updatedAt = new DateTimeOffset(updatedAt.Ticks - updatedAt.Ticks % 10, TimeSpan.Zero);
        if (updatedAt <= decisionOption.UpdatedAt) updatedAt = decisionOption.UpdatedAt.AddTicks(10);
        var affected = await _dbContext.DecisionOptions.Where(option =>
                option.Id == decisionOptionId && option.DecisionId == decisionId &&
                option.Decision.UserId == userId && option.UpdatedAt == request.ExpectedUpdatedAt.Value)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(option => option.Title, request.Title)
                .SetProperty(option => option.Url, request.Url)
                .SetProperty(option => option.ThumbnailUrl, request.ThumbnailUrl)
                .SetProperty(option => option.Description, request.Description)
                .SetProperty(option => option.Price, request.Price)
                .SetProperty(option => option.Currency, request.Currency)
                .SetProperty(option => option.UpdatedAt, updatedAt));
        if (affected != 1) throw new OptionConcurrencyException();

        decisionOption.Title = request.Title;
        decisionOption.Url = request.Url;
        decisionOption.ThumbnailUrl = request.ThumbnailUrl;
        decisionOption.Description = request.Description;
        decisionOption.Price = request.Price;
        decisionOption.Currency = request.Currency;
        decisionOption.UpdatedAt = updatedAt;

        return decisionOption;
    }

    public async Task<bool> DeleteAsync(
        Guid userId,
        Guid decisionId,
        Guid decisionOptionId
    )
    {
        var decisionOption = await _dbContext.DecisionOptions
            .FirstOrDefaultAsync(option =>
                option.Id == decisionOptionId &&
                option.DecisionId == decisionId &&
                option.Decision.UserId == userId
            );

        if (decisionOption == null)
        {
            return false;
        }

        _dbContext.DecisionOptions.Remove(decisionOption);

        await _dbContext.SaveChangesAsync();

        return true;
    }
}

public enum CreateDecisionOptionStatus
{
    Success,
    DecisionNotFound,
    InvalidCriterion,
    DuplicateCriterion
}

public class CreateDecisionOptionResult
{
    public CreateDecisionOptionStatus Status { get; init; }
    public DecisionOption? Option { get; init; }
}
