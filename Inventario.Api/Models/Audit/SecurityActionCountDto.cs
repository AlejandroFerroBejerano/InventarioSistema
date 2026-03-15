namespace Inventario.Api.Models.Audit;

public class SecurityActionCountDto
{
    public string Action { get; set; } = string.Empty;
    public int Count { get; set; }
}

