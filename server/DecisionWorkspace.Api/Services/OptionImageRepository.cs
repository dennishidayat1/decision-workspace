using DecisionWorkspace.Api.Data;
using DecisionWorkspace.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DecisionWorkspace.Api.Services;

public interface IOptionImageRepository
{
    Task<DecisionOption?> FindOwnedAsync(Guid userId, Guid decisionId, Guid optionId, CancellationToken token);
    Task<bool> TrySetImageAsync(Guid userId, DecisionOption snapshot, string imageUrl, DateTimeOffset updatedAt, CancellationToken token);
}

public sealed class OptionImageRepository(AppDbContext db) : IOptionImageRepository
{
    public Task<DecisionOption?> FindOwnedAsync(Guid userId, Guid decisionId, Guid optionId, CancellationToken token) =>
        db.DecisionOptions.AsNoTracking().FirstOrDefaultAsync(option =>
            option.Id == optionId && option.DecisionId == decisionId && option.Decision.UserId == userId, token);

    public async Task<bool> TrySetImageAsync(Guid userId, DecisionOption snapshot, string imageUrl, DateTimeOffset updatedAt, CancellationToken token) =>
        await db.DecisionOptions.Where(option =>
                option.Id == snapshot.Id && option.DecisionId == snapshot.DecisionId &&
                option.Decision.UserId == userId && option.UpdatedAt == snapshot.UpdatedAt)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(option => option.ImageUrl, imageUrl)
                .SetProperty(option => option.ThumbnailUrl, imageUrl)
                .SetProperty(option => option.UpdatedAt, updatedAt), token) == 1;
}
