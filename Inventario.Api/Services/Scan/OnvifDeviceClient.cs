using System.Net.Http.Headers;
using System.Text;
using System.Xml;
using System.Security;

namespace Inventario.Api.Services.Scan;

public record OnvifDeviceInfo(string? Manufacturer, string? Model, string? FirmwareVersion, string? SerialNumber);

public class OnvifDeviceClient
{
    private readonly HttpClient _http;

    public OnvifDeviceClient(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromMilliseconds(6800);
    }

    public async Task<OnvifDeviceInfo?> GetDeviceInformationAsync(
        string xaddr,
        string username,
        string password,
        CancellationToken ct)
    {
        // Algunos XAddrs vienen sin /onvif/device_service; otros ya lo traen.
        var endpoint = NormalizeDeviceServiceUrl(xaddr);

        var (nonceB64, created, digestB64) = OnvifWsSecurity.CreateUsernameTokenDigest(password);

        var soap = BuildGetDeviceInformationSoap(username, nonceB64, created, digestB64);

        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/soap+xml"));
        req.Content = new StringContent(soap, Encoding.UTF8, "application/soap+xml");

        using var res = await _http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            return null;

        var xml = await res.Content.ReadAsStringAsync(ct);
        return TryParseDeviceInformation(xml);
    }

    private static string NormalizeDeviceServiceUrl(string xaddr)
    {
        // Normalización conservadora
        // Si ya tiene "device_service", lo dejamos.
        if (xaddr.Contains("device_service", StringComparison.OrdinalIgnoreCase))
            return xaddr;

        // Si termina en /onvif/ -> le añadimos device_service
        if (xaddr.EndsWith("/onvif", StringComparison.OrdinalIgnoreCase))
            return xaddr.TrimEnd('/') + "/device_service";

        // Si no, intentamos /onvif/device_service
        return xaddr.TrimEnd('/') + "/onvif/device_service";
    }

    private static string BuildGetDeviceInformationSoap(string username, string nonceB64, string created, string digestB64)
    {
        // SOAP 1.2 + WS-Security UsernameToken (Digest)
        return
$@"<?xml version=""1.0"" encoding=""utf-8""?>
<s:Envelope xmlns:s=""http://www.w3.org/2003/05/soap-envelope""
            xmlns:tds=""http://www.onvif.org/ver10/device/wsdl""
            xmlns:wsse=""http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd""
            xmlns:wsu=""http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"">
  <s:Header>
    <wsse:Security s:mustUnderstand=""1"">
      <wsse:UsernameToken>
        <wsse:Username>{EscapeXml(username)}</wsse:Username>
        <wsse:Password Type=""http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest"">{digestB64}</wsse:Password>
        <wsse:Nonce EncodingType=""http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary"">{nonceB64}</wsse:Nonce>
        <wsu:Created>{created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetDeviceInformation/>
  </s:Body>
</s:Envelope>";
    }

    private static string EscapeXml(string s)
        => SecurityElement.Escape(s) ?? s;

    private static OnvifDeviceInfo? TryParseDeviceInformation(string xml)
    {
        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);

            string? Get(string localName)
                => doc.SelectSingleNode($"//*[local-name()='{localName}']")?.InnerText?.Trim();

            var manufacturer = Get("Manufacturer");
            var model = Get("Model");
            var firmware = Get("FirmwareVersion");
            var serial = Get("SerialNumber");

            // Si no hay nada, probablemente no era respuesta válida
            if (manufacturer is null && model is null && firmware is null && serial is null)
                return null;

            return new OnvifDeviceInfo(manufacturer, model, firmware, serial);
        }
        catch
        {
            return null;
        }
    }
}
