using System.IO;
using Inventario.Api.Data;
using Microsoft.EntityFrameworkCore;
using Inventario.Api.Security;


var builder = WebApplication.CreateBuilder(args);

var dbPath = Path.Combine(builder.Environment.ContentRootPath, "inventario.db");

builder.Services.AddDbContext<InventarioDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Servicios
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDataProtection();
builder.Services.AddSingleton<ISecretProtector, SecretProtector>();
//Servicios de Escaneo
builder.Services.AddSingleton<Inventario.Api.Services.Scan.TcpPortScanner>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.SsdpDiscovery>();
builder.Services.AddSingleton<Inventario.Api.Services.Scan.DiscoveryService>();
builder.Services.AddScoped<Inventario.Api.Services.Scan.CredentialProvider>();



var app = builder.Build();

// Pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

app.UseAuthorization();

// Mapea controladores (IMPORTANTE)
app.MapControllers();

app.Run();
