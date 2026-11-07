using System.Data;
using System.Data.Common;
using System.Text.RegularExpressions;
using DecisionOptionWorkspace.Api.Services;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Data;
using DecisionWorkspace.Api.Models;
using DecisionWorkspace.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

// Exercise production EF queries and UPDATE generation without opening a socket.
internal static class DatabaseCommandTests
{
    public static async Task RunAsync()
    {
        var owner = Guid.NewGuid();
        var option = new DecisionOption
        {
            Id = Guid.NewGuid(), DecisionId = Guid.NewGuid(), Title = "Saved title",
            ThumbnailUrl = "https://example.test/old.jpg", ImageUrl = "https://example.test/old.jpg",
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1), CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
        };
        var commands = new Commands(option);
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=1;Database=offline;Username=offline;Password=offline")
            .AddInterceptors(new NoConnections(), commands).Options;
        await using var db = new AppDbContext(options);
        var repository = new OptionImageRepository(db);
        Check(await repository.FindOwnedAsync(owner, option.DecisionId, option.Id, default) != null);
        Check(commands.LastRead!.Contains("\"UserId\" =") && commands.LastRead.Contains("\"DecisionId\" =") &&
            commands.LastRead.Contains("\"Id\" ="));
        Check(await repository.TrySetImageAsync(owner, option, "https://example.test/new.jpg", DateTimeOffset.UtcNow, default));
        var imageWrite = commands.LastWrite ?? throw new Exception("Missing image UPDATE");
        Check(imageWrite[imageWrite.IndexOf("WHERE", StringComparison.Ordinal)..].Contains("\"UpdatedAt\" =") && imageWrite.Contains("\"UserId\" ="));
        var set = imageWrite[..imageWrite.IndexOf("FROM", StringComparison.Ordinal)];
        Check(set.Contains("\"ImageUrl\" =") && set.Contains("\"ThumbnailUrl\" =") && !set.Contains("\"Title\" ="));
        Check(commands.LastParameters.Any(value => Equals(value, option.UpdatedAt)));
        commands.Affected = 0; // Simulates another request winning the atomic WHERE check.
        Check(!await repository.TrySetImageAsync(owner, option, "https://example.test/new.jpg", DateTimeOffset.UtcNow, default));

        var service = new DecisionOptionService(db);
        var request = new CreateDecisionOptionRequest
        {
            Title = "Edited title", ThumbnailUrl = "https://example.test/custom.jpg", ExpectedUpdatedAt = option.UpdatedAt,
        };
        try
        {
            await service.UpdateAsync(owner, option.DecisionId, option.Id, request);
            throw new Exception("Ordinary edit must reject an atomic conflict");
        }
        catch (OptionConcurrencyException) { }
        var ordinaryWrite = commands.LastWrite ?? throw new Exception("Missing ordinary UPDATE");
        Check(ordinaryWrite[ordinaryWrite.IndexOf("WHERE", StringComparison.Ordinal)..].Contains("\"UpdatedAt\" =") && ordinaryWrite.Contains("\"UserId\" ="));
        Check(commands.LastParameters.Any(value => Equals(value, option.UpdatedAt)));
        Check(!ordinaryWrite[..ordinaryWrite.IndexOf("FROM", StringComparison.Ordinal)].Contains("\"ImageUrl\" ="));
        commands.Affected = 1;
        var edited = await service.UpdateAsync(owner, option.DecisionId, option.Id, request);
        Check(edited!.Title == request.Title && edited.ImageUrl == option.ImageUrl && edited.UpdatedAt > option.UpdatedAt);
        commands.ReadExists = false;
        var writes = commands.WriteCount;
        Check(await service.UpdateAsync(owner, option.DecisionId, option.Id, request) == null && commands.WriteCount == writes);
        Console.WriteLine("PASS Production ownership predicates, image-only UPDATE, and ordinary-edit atomic concurrency (intercepted SQL; no database)");
    }

    private static void Check(bool value) { if (!value) throw new Exception("Database command assertion failed"); }

    private sealed class NoConnections : DbConnectionInterceptor
    {
        public override ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection,
            ConnectionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(InterceptionResult.Suppress());
    }

    private sealed class Commands(DecisionOption option) : DbCommandInterceptor
    {
        public string? LastRead, LastWrite;
        public object?[] LastParameters = [];
        public int Affected = 1, WriteCount;
        public bool ReadExists = true;

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            LastWrite = command.CommandText;
            LastParameters = command.Parameters.Cast<DbParameter>().Select(parameter => parameter.Value).ToArray();
            WriteCount++;
            return ValueTask.FromResult(InterceptionResult<int>.SuppressWithResult(Affected));
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            LastRead = command.CommandText;
            var table = new DataTable();
            var selected = command.CommandText[..command.CommandText.IndexOf("FROM", StringComparison.Ordinal)];
            var values = new List<object>();
            foreach (Match match in Regex.Matches(selected, "\\w+\\.\"(?<column>\\w+)\""))
            {
                var property = typeof(DecisionOption).GetProperty(match.Groups["column"].Value)!;
                table.Columns.Add(property.Name, Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType);
                values.Add(property.GetValue(option) ?? DBNull.Value);
            }
            if (ReadExists) table.Rows.Add(values.ToArray());
            return ValueTask.FromResult(InterceptionResult<DbDataReader>.SuppressWithResult(table.CreateDataReader()));
        }
    }
}
