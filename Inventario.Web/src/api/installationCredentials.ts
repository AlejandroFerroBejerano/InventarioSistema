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
  password?: string | null;
};

export type CredentialSecretDto = {
  credentialId: number;
  username: string;
  password: string;
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

export async function getInstallationCredentialSecret(
  abonadoMm: string,
  credentialId: number
): Promise<CredentialSecretDto> {
  const res = await fetch(
    `/api/installations/${encodeURIComponent(abonadoMm)}/credentials/${credentialId}/secret`
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo cargar la contraseña");
  }

  return res.json();
}

export async function deleteInstallationCredential(
  abonadoMm: string,
  credentialId: number,
  confirmation: string
): Promise<void> {
  const res = await fetch(
    `/api/installations/${encodeURIComponent(abonadoMm)}/credentials/${credentialId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo eliminar la credencial");
  }
}
