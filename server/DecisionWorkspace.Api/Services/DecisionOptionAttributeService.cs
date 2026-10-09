using DecisionWorkspace.Api.Data;
using Microsoft.EntityFrameworkCore;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Contracts;

namespace DecisionWorkspace.Api.Services;

public class DecisionOptionAttributeService
{
    private readonly AppDbContext _dbContext;

    public DecisionOptionAttributeService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private async Task<bool> DecisionOptionExistsAsync(Guid decisionId, Guid decisionOptionId)
    {
        return await _dbContext.DecisionOptions.AnyAsync(option => option.Id == decisionOptionId && option.DecisionId == decisionId);
    }

    public async Task<DecisionOptionAttribute?> CreateAsync(Guid decisionId, Guid decisionOptionId, CreateDecisionOptionAttributeRequest request)
    {
        if (!await DecisionOptionExistsAsync(decisionId, decisionOptionId))
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;

        var decisionOptionAttribute = new DecisionOptionAttribute
        {
            Id = Guid.NewGuid(),
            DecisionOptionId = decisionOptionId,
            Name = request.Name,
            Value = request.Value,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.DecisionOptionAttributes.Add(decisionOptionAttribute);
        await _dbContext.SaveChangesAsync();

        return decisionOptionAttribute;
    }

    public async Task<List<DecisionOptionAttribute>?> GetByDecisionOptionIdAsync(Guid decisionId, Guid decisionOptionId)
    {
        if (!await DecisionOptionExistsAsync(decisionId, decisionOptionId))
        {
            return null;
        }

        return await _dbContext.DecisionOptionAttributes
            .Where(attr => attr.DecisionOptionId == decisionOptionId)
            .ToListAsync();
    }

    public async Task<List<DecisionOptionAttribute>?> UpdateAsync(
        Guid decisionId,
        Guid decisionOptionId,
        List<CreateDecisionOptionAttributeRequest> requests
    )
    {
        if (!await DecisionOptionExistsAsync(
            decisionId,
            decisionOptionId
        ))
        {
            return null;
        }

        var existingAttributes =
            await _dbContext.DecisionOptionAttributes
                .Where(attribute =>
                    attribute.DecisionOptionId ==
                    decisionOptionId
                )
                .ToListAsync();

        _dbContext.DecisionOptionAttributes
            .RemoveRange(existingAttributes);

        var now = DateTimeOffset.UtcNow;

        var newAttributes = requests
            .Select(request =>
                new DecisionOptionAttribute
                {
                    Id = Guid.NewGuid(),
                    DecisionOptionId =
                        decisionOptionId,

                    Name = request.Name,
                    Value = request.Value,

                    CreatedAt = now,
                    UpdatedAt = now,
                }
            )
            .ToList();

        _dbContext.DecisionOptionAttributes
            .AddRange(newAttributes);

        await _dbContext.SaveChangesAsync();

        return newAttributes;
    }
}