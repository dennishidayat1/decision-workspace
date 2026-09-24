namespace DecisionWorkspace.Api.Models
{
    public class DecisionOptionAttribute
    {
        public Guid Id { get; set; }
        public Guid DecisionOptionId { get; set; }  
        public string Name { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public DecisionOption DecisionOption { get; set; } = null!;
    }
}