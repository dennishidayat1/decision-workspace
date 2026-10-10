namespace DecisionWorkspace.Api.Models;

public class Decision
{
  public Guid Id { get; set; }
  public Guid UserId { get; set; }
  public string Title { get; set; } = string.Empty;
  public string Question { get; set; } = string.Empty;
  public String? Context { get; set; }
  public String? Category { get; set; }
  public string Status { get; set; } = string.Empty;
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
}