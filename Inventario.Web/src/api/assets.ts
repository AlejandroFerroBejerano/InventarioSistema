export type SystemAssetListItemDto = {
  ipAddress: string;
  category?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  firmware?: string | null;
  serialNumber?: string | null;
  protocol?: string | null;
  status?: string | null;
  webPort?: number | null;
  sdkPort?: number | null;
  preferredCredentialId?: number | null;
  lastSeenAt?: string | null;
  openPortsList?: number[] | null;
};

export async function getAssets(abonadoMm: string): Promise<SystemAssetListItemDto[]> {
  const res = await fetch(`/api/assets?abonadoMm=${encodeURIComponent(abonadoMm.trim())}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Error ${res.status}`);
  }

  return res.json();
}
