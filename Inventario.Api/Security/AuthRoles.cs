namespace Inventario.Api.Security;

public static class AuthRoles
{
    public const string GlobalAdmin = "GlobalAdmin";
    public const string TechnicalAdmin = "TechnicalAdmin";
    public const string Operator = "Operator";
    public const string Auditor = "Auditor";

    public static readonly string[] All =
    {
        GlobalAdmin,
        TechnicalAdmin,
        Operator,
        Auditor
    };
}
