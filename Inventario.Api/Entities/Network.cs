namespace Inventario.Api.Entities;

public class Network
{
    public int Id { get; set; }

    public int InstallationId { get; set; }
    public Installation Installation { get; set; } = default!;

    public string Name { get; set; } = default!;
    public string Cidr { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}