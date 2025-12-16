using Microsoft.AspNetCore.DataProtection;

namespace Inventario.Api.Security;

public interface ISecretProtector
{
    string Protect(string plainText);
    string Unprotect(string protectedText);
}

public class SecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public SecretProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Inventario.Api.Credentials.v1");
    }

    public string Protect(string plainText) => _protector.Protect(plainText);

    public string Unprotect(string protectedText) => _protector.Unprotect(protectedText);
}
