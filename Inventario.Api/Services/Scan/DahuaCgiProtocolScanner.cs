using System.Net;
using Inventario.Api.Models.Scan;

namespace Inventario.Api.Services.Scan;

public sealed class DahuaCgiProtocolScanner : IProtocolScanner
{
    private readonly DahuaCgiClient _client;

    public DahuaCgiProtocolScanner(DahuaCgiClient client)
    {
        _client = client;
    }

    public string Name => "DahuaCgi";

    public bool CanTry(ScanHostResultDto host)
    {
        var ports = host.OpenPorts ?? new List<int>();
        return ports.Contains(80) || ports.Contains(443);
    }

    public async Task<ProtocolAuthResult?> TryAsync(
        ScanHostResultDto host,
        List<PlainCredential> credentials,
        CancellationToken ct)
    {
        var openPorts = host.OpenPorts ?? new List<int>();

        // Prioriza HTTP 80 (en tu caso funciona ahí), luego HTTPS 443
        var webPorts = new List<(int port, bool https)>();
        if (openPorts.Contains(80)) webPorts.Add((80, false));
        if (openPorts.Contains(443)) webPorts.Add((443, true));

        foreach (var (port, https) in webPorts)
        {
            // 1) Intento sin credenciales (raro, pero posible)
            var noAuth = await _client.GetAsync(
                host.Ip,
                port,
                https,
                "/cgi-bin/magicBox.cgi?action=getSystemInfo",
                credential: null,
                ct);

            if (noAuth.ok)
            {
                return BuildResult(
                    openPorts: openPorts,
                    webPort: port,
                    systemInfoBody: noAuth.body,
                    credentialId: null,
                    credentialUsername: null,
                    firmwareOverride: null
                );
            }

            // 2) Si pide auth -> probar credenciales
            if (noAuth.status is 401 or 403)
            {
                foreach (var cred in credentials)
                {
                    var netCred = new NetworkCredential(cred.Username, cred.Password);

                    var sysInfo = await _client.GetAsync(
                        host.Ip,
                        port,
                        https,
                        "/cgi-bin/magicBox.cgi?action=getSystemInfo",
                        netCred,
                        ct);

                    if (!sysInfo.ok) continue;

                    // Firmware real: intentar getSoftwareVersion (best effort)
                    var firmware = await TryGetFirmwareAsync(
                        ip: host.Ip,
                        port: port,
                        https: https,
                        cred: netCred,
                        ct: ct);

                    return BuildResult(
                        openPorts: openPorts,
                        webPort: port,
                        systemInfoBody: sysInfo.body,
                        credentialId: cred.CredentialId,
                        credentialUsername: cred.Username,
                        firmwareOverride: firmware
                    );
                }
            }
        }

        return null;
    }

    private async Task<string?> TryGetFirmwareAsync(
        string ip,
        int port,
        bool https,
        NetworkCredential cred,
        CancellationToken ct)
    {
        // Endpoint habitual para versión de sistema / firmware en Dahua
        var r = await _client.GetAsync(
            ip,
            port,
            https,
            "/cgi-bin/magicBox.cgi?action=getSoftwareVersion",
            cred,
            ct);

        if (!r.ok)
            return null;

        var kv = DahuaCgiClient.ParseKeyValues(r.body);

        // Distintos firmwares pueden devolver claves distintas
        kv.TryGetValue("version", out var version);
        if (string.IsNullOrWhiteSpace(version))
            kv.TryGetValue("SoftwareVersion", out version);
        if (string.IsNullOrWhiteSpace(version))
            kv.TryGetValue("Version", out version);

        kv.TryGetValue("buildDate", out var build);
        if (string.IsNullOrWhiteSpace(build))
            kv.TryGetValue("BuildDate", out build);

        if (!string.IsNullOrWhiteSpace(version))
        {
            if (!string.IsNullOrWhiteSpace(build))
                return $"{version} ({build})";

            return version;
        }

        return null;
    }

    private static ProtocolAuthResult BuildResult(
        List<int> openPorts,
        int webPort,
        string systemInfoBody,
        int? credentialId,
        string? credentialUsername,
        string? firmwareOverride)
    {
        var kv = DahuaCgiClient.ParseKeyValues(systemInfoBody);

        kv.TryGetValue("deviceType", out var deviceType);
        kv.TryGetValue("serialNumber", out var serial);

        var sdkPort = openPorts.Contains(37777) ? 37777 : (int?)null;

        // Firma real:
        // ProtocolAuthResult(bool Success, string Protocol, string? Manufacturer, string? Model,
        //                  string? Firmware, string? SerialNumber, int? WebPort, int? SdkPort,
        //                  int? CredentialId, string? CredentialUsername)
        return new ProtocolAuthResult(
            Success: true,
            Protocol: "DahuaCgi",
            Manufacturer: "Dahua",
            Model: deviceType,
            Firmware: firmwareOverride,
            SerialNumber: serial,
            WebPort: webPort,
            SdkPort: sdkPort,
            CredentialId: credentialId,
            CredentialUsername: credentialUsername
        );
    }
}
