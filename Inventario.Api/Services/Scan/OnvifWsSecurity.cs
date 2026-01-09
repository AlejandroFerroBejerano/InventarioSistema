using System.Security.Cryptography;
using System.Text;

namespace Inventario.Api.Services.Scan;

public static class OnvifWsSecurity
{
    public static (string NonceB64, string Created, string PasswordDigestB64) CreateUsernameTokenDigest(string password)
    {
        var nonceBytes = RandomNumberGenerator.GetBytes(16);
        var created = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

        var createdBytes = Encoding.UTF8.GetBytes(created);
        var passwordBytes = Encoding.UTF8.GetBytes(password);

        // PasswordDigest = Base64( SHA1( nonce + created + password ) )
        using var sha1 = SHA1.Create();
        var combined = new byte[nonceBytes.Length + createdBytes.Length + passwordBytes.Length];
        Buffer.BlockCopy(nonceBytes, 0, combined, 0, nonceBytes.Length);
        Buffer.BlockCopy(createdBytes, 0, combined, nonceBytes.Length, createdBytes.Length);
        Buffer.BlockCopy(passwordBytes, 0, combined, nonceBytes.Length + createdBytes.Length, passwordBytes.Length);

        var digest = sha1.ComputeHash(combined);

        return (Convert.ToBase64String(nonceBytes), created, Convert.ToBase64String(digest));
    }
}
