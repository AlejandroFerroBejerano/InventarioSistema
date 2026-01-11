export type InstallationListItem = {
  id: number;
  abonadoMm: string;
  name: string;
};

export async function getInstallations(): Promise<InstallationListItem[]> {
  const res = await fetch("/api/installations");
  if (!res.ok) throw new Error("No se pudieron cargar instalaciones");
  return res.json();
}

export async function createInstallation(input: { abonadoMm: string; name: string }) {
  const res = await fetch("/api/installations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      abonadoMm: input.abonadoMm,
      nombre: input.name, // 👈 CLAVE: el backend espera "Nombre"
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "No se pudo crear la instalación");
  }

  return res.json();
}

