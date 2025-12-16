using Inventario.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace Inventario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientesController : ControllerBase
{
    [HttpGet]
    public ActionResult<List<ClienteDto>> Get()
    {
        var cliente = new ClienteDto
        {
            Nombre = "Cliente Demo",
            AbonadoMm = "MM00000001",
            Sistemas =
            [
                new SistemaDto
                {
                    AbonadoMm = "MM00000001",
                    Productos = ["Videograbador"],
                    Fabricante = "Hikvision",
                    Modelo = "DS-7608NI-I2",
                    SerialNumber = "SN123456789",
                    Firmware = "V4.72.000",
                    DireccionIp = "192.168.1.10",
                    MascaraRed = "255.255.255.0",
                    DireccionMac = "00:11:22:33:44:55",
                    PuertoWeb = 80,
                    PuertoSdk = 8000,
                    Usuario = "admin",
                    Contrasena = "******",
                    Dispositivos =
                    [
                        new DispositivoDto
                        {
                            DispId = "CAM-001",
                            Nombre = "Cámara Entrada",
                            Fabricante = "Axis",
                            Modelo = "P3245-LVE",
                            SerialNumber = "AXIS-SN-0001",
                            Firmware = "10.12.221",
                            DireccionIp = "192.168.1.21",
                            MascaraRed = "255.255.255.0",
                            DireccionMac = "AA:BB:CC:DD:EE:01",
                            PuertoWeb = 80,
                            Usuario = "root",
                            Contrasena = "******"
                        }
                    ]
                }
            ]
        };

        return Ok(new List<ClienteDto> { cliente });
    }
}
