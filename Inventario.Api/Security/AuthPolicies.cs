namespace Inventario.Api.Security;

public static class AuthPolicies
{
    public const string ManageUsers = "CanManageUsers";
    public const string ManageRoles = "CanManageRoles";
    public const string OperateScans = "CanOperateScans";
    public const string ViewAudit = "CanViewAudit";
    public const string ViewInventory = "CanViewInventory";
}
