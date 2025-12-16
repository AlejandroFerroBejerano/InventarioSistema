using System.Net;

namespace Inventario.Api.Services.Scan;
//expansión de CIDR → lista de IPs
public static class CidrHelper
{
    public static List<IPAddress> Expand(string cidr)
    {
        // Ejemplo soportado: 192.168.1.0/24
        var parts = cidr.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2) throw new ArgumentException("CIDR inválido. Ej: 192.168.1.0/24");

        if (!IPAddress.TryParse(parts[0], out var baseIp))
            throw new ArgumentException("IP base inválida en CIDR.");

        if (!int.TryParse(parts[1], out var prefix) || prefix < 0 || prefix > 32)
            throw new ArgumentException("Prefijo CIDR inválido.");

        var bytes = baseIp.GetAddressBytes();
        if (bytes.Length != 4) throw new ArgumentException("Solo IPv4 soportado en este MVP.");

        uint ip = ToUInt32(bytes);
        uint mask = prefix == 0 ? 0 : uint.MaxValue << (32 - prefix);
        uint network = ip & mask;
        uint broadcast = network | ~mask;

        // Para /32: solo una IP
        // Para redes normales: evitamos network y broadcast (si hay espacio)
        var result = new List<IPAddress>();

        uint start = network;
        uint end = broadcast;

        if (prefix <= 30) // hay network y broadcast distinguibles
        {
            start = network + 1;
            end = broadcast - 1;
        }

        for (uint current = start; current <= end; current++)
        {
            result.Add(new IPAddress(ToBytes(current)));
        }

        return result;
    }

    private static uint ToUInt32(byte[] bytes)
        => ((uint)bytes[0] << 24) | ((uint)bytes[1] << 16) | ((uint)bytes[2] << 8) | bytes[3];

    private static byte[] ToBytes(uint value)
        => new[]
        {
            (byte)((value >> 24) & 0xFF),
            (byte)((value >> 16) & 0xFF),
            (byte)((value >> 8) & 0xFF),
            (byte)(value & 0xFF)
        };
}
