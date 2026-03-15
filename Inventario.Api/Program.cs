using System.IO;
using System.Text;
using Inventario.Api.Data;
using Inventario.Api.Entities;
using Inventario.Api.Hubs;
using Inventario.Api.Security;
using Inventario.Api.Services;
using Inventario.Api.Services.Agents;
using Inventario.Api.Services.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var dbPath = Path.Combine(builder.Environment.ContentRootPath, "inventario.db");

builder.Services.AddDbContext<InventarioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(type => type.FullName);
});

builder.Services.AddDataProtection();
builder.Services.AddSingleton<ISecretProtector, SecretProtector>();
builder.Services.AddSingleton<IAgentTokenService, AgentTokenService>();

builder.Services.AddSingleton<Inventario.Api.Services.Scan.DiscoveryService>();
builder.Services.AddScoped<Inventario.Api.Services.Scan.CredentialProvider>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.TcpPortScanner>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.SsdpDiscovery>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.AxisVapixClient>();
builder.Services.AddScoped<Inventario.Api.Services.Scan.IProtocolScanner, Inventario.Api.Services.Scan.AxisVapixProtocolScanner>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.DahuaCgiClient>();
builder.Services.AddScoped<Inventario.Api.Services.Scan.IProtocolScanner, Inventario.Api.Services.Scan.DahuaCgiProtocolScanner>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.HikvisionIsapiClient>();
builder.Services.AddScoped<Inventario.Api.Services.Scan.IProtocolScanner, Inventario.Api.Services.Scan.HikvisionIsapiProtocolScanner>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.OnvifDiscoveryService>();
builder.Services.AddHttpClient<Inventario.Api.Services.Scan.OnvifDeviceClient>()
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback =
            HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
    });
builder.Services.AddScoped<Inventario.Api.Services.Scan.IProtocolScanner, Inventario.Api.Services.Scan.OnvifProtocolScanner>();

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(30);
})
.AddEntityFrameworkStores<InventarioDbContext>()
.AddDefaultTokenProviders();

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IUserSessionService, UserSessionService>();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();

    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
        ClockSkew = TimeSpan.FromMinutes(1)
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var sessionService = context.HttpContext.RequestServices.GetRequiredService<IUserSessionService>();
            var sessionId = context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;

            if (string.IsNullOrWhiteSpace(sessionId) || !await sessionService.IsActiveAsync(sessionId))
            {
                context.Fail("Session is not active.");
                return;
            }

            await sessionService.MarkActiveAsync(sessionId);
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthPolicies.ManageUsers, policy =>
        policy.RequireRole(AuthRoles.GlobalAdmin, AuthRoles.TechnicalAdmin));

    options.AddPolicy(AuthPolicies.ManageRoles, policy =>
        policy.RequireRole(AuthRoles.GlobalAdmin));

    options.AddPolicy(AuthPolicies.OperateScans, policy =>
        policy.RequireRole(AuthRoles.GlobalAdmin, AuthRoles.TechnicalAdmin, AuthRoles.Operator));

    options.AddPolicy(AuthPolicies.ViewAudit, policy =>
        policy.RequireRole(AuthRoles.GlobalAdmin, AuthRoles.Auditor));

    options.AddPolicy(AuthPolicies.ViewInventory, policy =>
        policy.RequireRole(AuthRoles.GlobalAdmin, AuthRoles.TechnicalAdmin, AuthRoles.Operator, AuthRoles.Auditor));
});

builder.Services.AddSignalR();
builder.Services.AddScoped<AgentDispatchService>();
builder.Services.AddScoped<AgentScanResultService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InventarioDbContext>();
    db.Database.Migrate();
    await SeedIdentityData(scope.ServiceProvider);
    await SeedDefaultAdmin(scope.ServiceProvider, app.Configuration);
    app.Logger.LogInformation("SQLite DB path: {DbPath}", dbPath);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<AgentHub>("/hubs/agents");
app.Run();

static async Task SeedIdentityData(IServiceProvider serviceProvider)
{
    var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in AuthRoles.All)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
        }
    }
}

static async Task SeedDefaultAdmin(IServiceProvider serviceProvider, IConfiguration configuration)
{
    var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var defaultAdminEmail = configuration["Security:Seed:DefaultAdminEmail"]?.Trim();
    var defaultAdminPassword = configuration["Security:Seed:DefaultAdminPassword"]?.Trim();

    if (string.IsNullOrWhiteSpace(defaultAdminEmail) || string.IsNullOrWhiteSpace(defaultAdminPassword))
    {
        return;
    }

    var existing = await userManager.FindByEmailAsync(defaultAdminEmail);
    if (existing is not null)
    {
        if (await userManager.IsInRoleAsync(existing, AuthRoles.GlobalAdmin))
        {
            return;
        }

        await userManager.AddToRoleAsync(existing, AuthRoles.GlobalAdmin);
        return;
    }

    var admin = new ApplicationUser
    {
        UserName = defaultAdminEmail,
        Email = defaultAdminEmail,
        DisplayName = "Administrador Global",
        Status = "Active",
        EmailConfirmed = true,
        CreatedAtUtc = DateTime.UtcNow
    };

    var created = await userManager.CreateAsync(admin, defaultAdminPassword);
    if (created.Succeeded)
    {
        await userManager.AddToRoleAsync(admin, AuthRoles.GlobalAdmin);
    }
}
