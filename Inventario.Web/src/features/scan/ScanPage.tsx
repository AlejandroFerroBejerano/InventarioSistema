import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Table,
  ScrollArea,
  Progress,
  Menu,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { IconDownload, IconFileTypeCsv, IconBraces } from "@tabler/icons-react";

import { startScan, type ScanResponseDto } from "../../api/scans";

function statusBadge(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "authenticated") return <Badge color="green" variant="light">Authenticated</Badge>;
  if (s === "identified") return <Badge color="blue" variant="light">Identified</Badge>;
  if (s === "noports") return <Badge color="gray" variant="light">NoPorts</Badge>;
  if (!status) return <Text c="dimmed">-</Text>;
  return <Badge color="yellow" variant="light">{status}</Badge>;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

export function ScanPage() {
  const [abonadoMm, setAbonadoMm] = useState("000000");
  const [networkCidr, setNetworkCidr] = useState("192.168.1.0/24");
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [filter, setFilter] = useState("");
  const [applyMode, setApplyMode] = useState<"NoDegrade" | "LastWins" | "Review">("NoDegrade");

  const mutation = useMutation({
    mutationFn: () =>
      startScan({
        abonadoMm: abonadoMm.trim(),
        networkCidr: networkCidr.trim(),
        applyMode,
        connectTimeoutMs: 800,
        maxConcurrency: 200,
        useSsdp: true,
        ssdpListenMs: 1500,
      }),
    onMutate: () => {
      setStartedAtMs(Date.now());
      setElapsedMs(0);
    },
    onSuccess: () => {
      notifications.show({
        title: "Escaneo terminado",
        message: "Se han recibido resultados del backend.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error al escanear",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  // ticker de tiempo mientras esté escaneando
  useEffect(() => {
    if (!mutation.isPending || startedAtMs === null) return;

    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtMs);
    }, 250);

    return () => window.clearInterval(id);
  }, [mutation.isPending, startedAtMs]);

  const result: ScanResponseDto | null = mutation.data ?? null;

  const counts = useMemo(() => {
    const hosts = result?.hosts ?? [];
    const authenticated = hosts.filter((h) => (h.status ?? "").toLowerCase() === "authenticated").length;
    const identified = hosts.filter((h) => (h.status ?? "").toLowerCase() === "identified").length;
    return { total: hosts.length, authenticated, identified };
  }, [result]);

  // Lista para export y para render (filtrada + ordenada)
  const exportHosts = useMemo(() => {
    const hosts = result?.hosts ?? [];
    if (hosts.length === 0) return [];

    const score = (s?: string | null) => {
      const v = (s ?? "").toLowerCase();
      if (v === "authenticated") return 0;
      if (v === "identified") return 1;
      return 2;
    };

    const q = filter.trim().toLowerCase();

    const filtered =
      q.length === 0
        ? hosts
        : hosts.filter((h) => {
            const haystack = [
              h.ip,
              (h.openPorts ?? []).join(","),
              h.protocol ?? "",
              h.manufacturer ?? "",
              h.model ?? "",
              h.firmware ?? "",
              h.serialNumber ?? "",
              h.status ?? "",
              h.credentialUsername ?? "",
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(q);
          });

    return [...filtered].sort((a, b) => score(a.status) - score(b.status) || a.ip.localeCompare(b.ip));
  }, [result, filter]);

  const rows = useMemo(() => {
    if (!exportHosts.length) return null;

    return exportHosts.map((h) => (
      <Table.Tr key={h.ip}>
        <Table.Td>{h.ip}</Table.Td>
        <Table.Td>{(h.openPorts ?? []).join(", ")}</Table.Td>
        <Table.Td>{h.protocol ?? "-"}</Table.Td>
        <Table.Td>{h.manufacturer ?? "-"}</Table.Td>
        <Table.Td>{h.model ?? "-"}</Table.Td>
        <Table.Td>{h.firmware ?? "-"}</Table.Td>
        <Table.Td>{h.serialNumber ?? "-"}</Table.Td>
        <Table.Td>{statusBadge(h.status)}</Table.Td>
        <Table.Td>{h.credentialUsername ?? "-"}</Table.Td>
      </Table.Tr>
    ));
  }, [exportHosts]);

  const elapsedText = useMemo(() => {
    const ms = mutation.isPending ? elapsedMs : elapsedMs;
    const secs = Math.floor(ms / 1000);
    const min = Math.floor(secs / 60);
    const rem = secs % 60;
    return min > 0 ? `${min}m ${rem}s` : `${rem}s`;
  }, [elapsedMs, mutation.isPending]);

  const exportBaseName = `scan_${abonadoMm}_${networkCidr.replaceAll("/", "-")}`;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>Escaneo</Title>
            <Text c="dimmed">
              Ejecuta <code>POST /api/scans</code> y muestra resultados.
            </Text>
          </div>

          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={3}>Escaneo</Title>
              <Text c="dimmed">
                Ejecuta <code>POST /api/scans</code> y muestra resultados.
              </Text>
            </div>

            <Group gap="xs">
              <Menu shadow="md" width={240}>
                <Menu.Target>
                  <Button variant="light">
                    {applyMode === "NoDegrade"
                      ? "No degradar"
                      : applyMode === "LastWins"
                        ? "Último gana"
                        : "Validar cambios"}
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Modo de aplicación</Menu.Label>

                  <Menu.Item onClick={() => setApplyMode("NoDegrade")}>
                    No degradar (recomendado)
                  </Menu.Item>

                  <Menu.Item onClick={() => setApplyMode("LastWins")}>
                    Lo último gana
                  </Menu.Item>

                  <Menu.Item
                    onClick={() => setApplyMode("Review")}
                  >
                    Validar cambios (próximamente)
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>

              <Button
                loading={mutation.isPending}
                onClick={() => {
                  if (applyMode === "Review") {
                    notifications.show({
                      title: "Modo no disponible aún",
                      message: "Validar cambios se implementará más adelante. Usando 'No degradar'.",
                      color: "yellow",
                    });
                    setApplyMode("NoDegrade");
                    mutation.mutate();
                    return;
                  }
                  mutation.mutate();
                }}
              >
                Iniciar escaneo
              </Button>
            </Group>
          </Group>
        </Group>

        <Stack gap="sm" mt="md">
          <TextInput
            label="AbonadoMm"
            value={abonadoMm}
            onChange={(e) => setAbonadoMm(e.currentTarget.value)}
          />
          <TextInput
            label="Network CIDR"
            value={networkCidr}
            onChange={(e) => setNetworkCidr(e.currentTarget.value)}
          />
        </Stack>

        <Stack gap={6} mt="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {mutation.isPending ? "Escaneando..." : "Listo"}
            </Text>
            <Text size="sm" c="dimmed">
              Tiempo: {startedAtMs ? elapsedText : "-"}
            </Text>
          </Group>
          {mutation.isPending && <Progress value={100} animated />}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Resultados</Title>
            <Text size="sm" c="dimmed">
              Mostrando: {exportHosts.length} (filtrados) / {counts.total} (total)
            </Text>
          </div>

          <Group gap="xs">
            <Badge variant="light">{counts.total} hosts</Badge>
            <Badge color="green" variant="light">{counts.authenticated} auth</Badge>
            <Badge color="blue" variant="light">{counts.identified} id</Badge>

            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button
                  variant="light"
                  leftSection={<IconDownload size={18} />}
                  disabled={!exportHosts.length}
                >
                  Exportar
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFileTypeCsv size={18} />}
                  onClick={() => {
                    const header = [
                      "ip",
                      "openPorts",
                      "webPort",
                      "protocol",
                      "manufacturer",
                      "model",
                      "firmware",
                      "serialNumber",
                      "status",
                      "category",
                      "credentialUsername",
                      "credentialId",
                    ];

                    const lines = [
                      header.map(csvEscape).join(","),
                      ...exportHosts.map((h) =>
                        [
                          h.ip,
                          (h.openPorts ?? []).join("|"),
                          h.webPort ?? "",
                          h.protocol ?? "",
                          h.manufacturer ?? "",
                          h.model ?? "",
                          h.firmware ?? "",
                          h.serialNumber ?? "",
                          h.status ?? "",
                          h.category ?? "",
                          h.credentialUsername ?? "",
                          h.credentialId ?? "",
                        ]
                          .map(csvEscape)
                          .join(",")
                      ),
                    ];

                    downloadTextFile(`${exportBaseName}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
                  }}
                >
                  CSV
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconBraces size={18}/>}
                  onClick={() => {
                    downloadTextFile(
                      `${exportBaseName}.json`,
                      JSON.stringify(exportHosts, null, 2),
                      "application/json;charset=utf-8"
                    );
                  }}
                >
                  JSON
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <TextInput
          mt="md"
          placeholder="Filtrar por IP / fabricante / modelo / protocolo / credencial..."
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
        />

        <ScrollArea mt="md">
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>IP</Table.Th>
                <Table.Th>Puertos</Table.Th>
                <Table.Th>Protocolo</Table.Th>
                <Table.Th>Fabricante</Table.Th>
                <Table.Th>Modelo</Table.Th>
                <Table.Th>Firmware</Table.Th>
                <Table.Th>Serial</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Credencial</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows ?? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text c="dimmed">
                      {mutation.isPending
                        ? "Escaneando..."
                        : "Aún no hay resultados. Lanza un escaneo."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </Stack>
  );
}
