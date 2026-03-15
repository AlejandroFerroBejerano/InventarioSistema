using System.IO;
using Inventario.Api.Data;
using Inventario.Api.Hubs;
using Inventario.Api.Security;
using Inventario.Api.Services.Agents;
using Microsoft.EntityFrameworkCore;

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

builder.Services.AddSignalR();
builder.Services.AddScoped<AgentDispatchService>();
builder.Services.AddScoped<AgentScanResultService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InventarioDbContext>();
    db.Database.Migrate();

    app.Logger.LogInformation("SQLite DB path: {DbPath}", dbPath);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();
app.MapControllers();
app.MapHub<AgentHub>("/hubs/agents");
app.Run();
