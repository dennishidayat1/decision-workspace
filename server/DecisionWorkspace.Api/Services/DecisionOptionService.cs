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

    public async Task<DecisionOption?> CreateAsync(Guid decisionId, CreateDecisionOptionRequest request)
    {
        if (!await DecisionExistsAsync(decisionId))
        {
            return null;
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
        };

        _dbContext.DecisionOptions.Add(decisionOption);
        await _dbContext.SaveChangesAsync();

        return decisionOption;
    }

    private async Task<bool> DecisionExistsAsync(Guid decisionId)
    {
        return await _dbContext.Decisions
            .AnyAsync(d => d.Id == decisionId);
    }

    public async Task<List<DecisionOption>?> GetByDecisionIdAsync(Guid decisionId)
    {
        if (!await DecisionExistsAsync(decisionId))
        {
            return null;
        }

        return await _dbContext.DecisionOptions
            .Where(d => d.DecisionId == decisionId)
            .ToListAsync();
    }
}