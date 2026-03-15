using System.Security.Cryptography;
using System.Text;

namespace Inventario.Api.Services.Agents;

public interface IAgentTokenService
{
    string GenerateToken();
    string Hash(string token);
    bool Verify(string token, string? hash);
}

public class AgentTokenService : IAgentTokenService
{
    public string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    public string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public bool Verify(string token, string? hash)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(hash))
            return false;

        try
        {
            var expected = Convert.FromHexString(hash);
            var candidate = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return CryptographicOperations.FixedTimeEquals(expected, candidate);
        }
        catch
        {
            return false;
        }
    }
}
