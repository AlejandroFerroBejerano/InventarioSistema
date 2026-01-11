export type CredentialListItemDto = {
  credentialId: number;
  username: string;
  label?: string | null;
  priority: number;
  scope: string;
  isActive: boolean;
  createdAt: string;
};

export type CreateCredentialRequest = {
  username: string;
  password: string;
  priority: number;
  scope: string;
  label?: string | null;
  isActive: boolean;
};

export type UpdateCredentialRequest = {
  priority?: number;
  scope?: string | null;
  label?: string | null;
  isActive?: boolean;
};

export async function getInstallationCredentials(abonadoMm: string): Promise<CredentialListItemDto[]> {
  const res = await fetch(`/api/installations/${encodeURIComponent(abonadoMm)}/credentials`);
  if (!res.ok) throw new Error("No se pudieron cargar credenciales");
  return res.json();
}

export async function addInstallationCredential(
  abonadoMm: string,
  req: CreateCredentialRequest
): Promise<any> {
  const res = await fetch(`/api/installations/${encodeURIComponent(abonadoMm)}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo crear la credencial");
  }

  return res.json();
}

export async function updateInstallationCredential(
  abonadoMm: string,
  credentialId: number,
  req: UpdateCredentialRequest
): Promise<void> {
  const res = await fetch(
    `/api/installations/${encodeURIComponent(abonadoMm)}/credentials/${credentialId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo actualizar la credencial");
  }
}
