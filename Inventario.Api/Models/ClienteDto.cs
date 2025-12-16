namespace Inventario.Api.Models;

public class ClienteDto
{
    public string Nombre { get; set; } = string.Empty;
    public string AbonadoMm { get; set; } = string.Empty;

    public List<SistemaDto> Sistemas { get; set; } = new();
}
