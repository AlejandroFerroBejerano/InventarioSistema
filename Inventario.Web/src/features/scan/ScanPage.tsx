import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberFormatter,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconCirclePlus,
  IconDownload,
  IconNetwork,
  IconPlayerPlay,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { startScan, type ScanResponseDto } from "../../api/scans";
import { InstallationPicker } from "../installations/components/InstallationPicker";
import { createInstallation, getInstallations } from "../../api/installations";
import { useSelectedInstallation } from "../installations/useSelectedInstallation";

type SavedNetwork = {
  id: string;
  name: string;
  cidr: string;
  createdAt: string;
};

const LS_KEY = "inventario.web.savedNetworks.v1";

function loadNetworks(): SavedNetwork[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function saveNetworks(items: SavedNetwork[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function statusBadge(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "authenticated")
    return (
      <Badge color="green" variant="light">
        Auth
      </Badge>
    );
  if (s === "identified")
    return (
      <Badge color="blue" variant="light">
        Id
      </Badge>
    );
  if (s === "noports")
    return (
      <Badge color="gray" variant="light">
        NoPorts
      </Badge>
    );
  if (!status) return <Text c="dimmed">-</Text>;
  return (
    <Badge color="yellow" variant="light">
      {status}
    </Badge>
  );
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
  const qc = useQueryClient();
  const [networks, setNetworks] = useState<SavedNetwork[]>(() => loadNetworks());
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(() => {
    const items = loadNetworks();
    return items[0]?.id ?? "";
  });

  const selectedNetwork = useMemo(
    () => networks.find((n) => n.id === selectedNetworkId) ?? null,
    [networks, selectedNetworkId]
  );

  const [createOpen, createModal] = useDisclosure(false);
  const [newName, setNewName] = useState("");
  const [newCidr, setNewCidr] = useState("192.168.1.0/24");

  const [filter, setFilter] = useState("");

  // Instalaciones/abonados
  const { selectedAbonadoMm, setSelectedAbonadoMm } = useSelectedInstallation();
  const installationsQuery = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
  });

  const createInstallationMutation = useMutation({
    mutationFn: createInstallation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["installations"] });
      notifications.show({
        title: "Instalación creada",
        message: "Ya puedes usarla para escanear.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error creando instalación",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  // Escaneo
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const scanMutation = useMutation({
    mutationFn: () =>
      startScan({
        abonadoMm: (selectedAbonadoMm ?? "").trim(),
        networkCidr: (selectedNetwork?.cidr ?? "").trim(),
        applyMode: "NoDegrade",
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

  useEffect(() => {
    if (!scanMutation.isPending || startedAtMs === null) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtMs), 250);
    return () => window.clearInterval(id);
  }, [scanMutation.isPending, startedAtMs]);

  const result: ScanResponseDto | null = scanMutation.data ?? null;

  const elapsedText = useMemo(() => {
    const ms = elapsedMs;
    const secs = Math.floor(ms / 1000);
    const min = Math.floor(secs / 60);
    const rem = secs % 60;
    return min > 0 ? `${min}m ${rem}s` : `${rem}s`;
  }, [elapsedMs]);

  const hosts = useMemo(() => result?.hosts ?? [], [result]);

  const counts = useMemo(() => {
    // ✅ Host contabilizable = ha respondido a algún protocolo (protocol no vacío).
    // Si no responde a ninguno, NO cuenta como Host (aunque tenga puertos abiertos).
    const countableHosts = hosts.filter((h) => (h.protocol ?? "").trim().length > 0);

    const authenticated = countableHosts.filter(
      (h) => (h.status ?? "").toLowerCase() === "authenticated"
    ).length;

    const identified = countableHosts.filter(
      (h) => (h.status ?? "").toLowerCase() === "identified"
    ).length;

    const noports = countableHosts.filter((h) => (h.status ?? "").toLowerCase() === "noports").length;

    return {
      total: countableHosts.length,
      authenticated,
      identified,
      noports,
      other: Math.max(0, countableHosts.length - authenticated - identified - noports),
    };
  }, [hosts]);

  const protocols = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hosts) {
      const k = (h.protocol ?? "Unknown").trim() || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [hosts]);

  const manufacturers = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hosts) {
      const k = (h.manufacturer ?? "Unknown").trim() || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [hosts]);

  const ports = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hosts) {
      for (const p of h.openPorts ?? []) {
        const k = String(p);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [hosts]);

  const filteredHosts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => {
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
  }, [hosts, filter]);

  const exportBaseName = useMemo(() => {
    const mm = (selectedAbonadoMm ?? "").trim() || "no_install";
    const cidr = (selectedNetwork?.cidr ?? "net").replaceAll("/", "-");
    return `scan_${mm}_${cidr}`;
  }, [selectedAbonadoMm, selectedNetwork?.cidr]);

  const canScan = Boolean(selectedAbonadoMm && selectedNetwork?.cidr);

  return (
    <Stack gap="md">
      <Modal opened={createOpen} onClose={createModal.close} title="Nueva red" centered>
        <Stack>
          <TextInput
            label="Nombre"
            placeholder="Oficina · VLAN 20"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
          <TextInput
            label="CIDR"
            placeholder="192.168.20.0/24"
            value={newCidr}
            onChange={(e) => setNewCidr(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              onClick={() => {
                const name = newName.trim();
                const cidr = newCidr.trim();
                if (!name || !cidr) {
                  notifications.show({
                    title: "Faltan datos",
                    message: "Nombre y CIDR son obligatorios.",
                    color: "red",
                  });
                  return;
                }

                const item: SavedNetwork = {
                  id: crypto.randomUUID(),
                  name,
                  cidr,
                  createdAt: new Date().toISOString(),
                };

                const next = [item, ...networks];
                setNetworks(next);
                saveNetworks(next);
                setSelectedNetworkId(item.id);
                setNewName("");
                createModal.close();
              }}
            >
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Top cards: installation + quick actions */}
      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={3} style={{ letterSpacing: -0.3 }}>
              Escaneo de red
            </Title>
            <Text c="dimmed" size="sm">
              Gestiona redes, lanza escaneos y revisa resultados agrupados por protocolo, puertos y fabricante.
            </Text>
          </Box>

          <Group gap="sm">
            <Button
              leftSection={<IconPlayerPlay size={18} />}
              loading={scanMutation.isPending}
              disabled={!canScan}
              onClick={() => scanMutation.mutate()}
            >
              Iniciar escaneo
            </Button>

            <Button
              variant="light"
              leftSection={<IconCirclePlus size={18} />}
              onClick={createModal.open}
            >
              Nueva red
            </Button>
          </Group>
        </Group>

        <Divider my="md" />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
          />

          <Group align="flex-end" justify="space-between" wrap="nowrap">
            <TextInput
              label="Buscar en resultados"
              leftSection={<IconSearch size={16} />}
              placeholder="IP, modelo, fabricante, protocolo…"
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              w="100%"
            />

            <Tooltip label={scanMutation.isPending ? "Escaneando…" : "Tiempo desde el inicio"}>
              <Badge variant="light" size="lg">
                {startedAtMs ? elapsedText : "-"}
              </Badge>
            </Tooltip>
          </Group>
        </SimpleGrid>
      </Card>

      {/* App-like 2-column layout: left networks, right detail */}
      <SimpleGrid cols={{ base: 1, md: 12 }} spacing="md">
        {/* Left panel: networks */}
        <Card withBorder radius="lg" p="md" style={{ gridColumn: "span 4" }}>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconNetwork size={18} />
              <Text fw={600}>Redes</Text>
            </Group>
            <ActionIcon variant="subtle" onClick={createModal.open} aria-label="Nueva red">
              <IconCirclePlus size={18} />
            </ActionIcon>
          </Group>

          <ScrollArea h={420} offsetScrollbars>
            <Stack gap={6}>
              {networks.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Aún no tienes redes guardadas. Crea una para empezar.
                </Text>
              ) : (
                networks.map((n) => {
                  const active = n.id === selectedNetworkId;
                  return (
                    <Card
                      key={n.id}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{
                        cursor: "pointer",
                        borderColor: active ? "var(--mantine-color-indigo-5)" : undefined,
                      }}
                      onClick={() => setSelectedNetworkId(n.id)}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Box style={{ minWidth: 0 }}>
                          <Text fw={600} truncate>
                            {n.name}
                          </Text>
                          <Text size="sm" c="dimmed" truncate>
                            {n.cidr}
                          </Text>
                        </Box>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = networks.filter((x) => x.id !== n.id);
                            setNetworks(next);
                            saveNetworks(next);
                            if (selectedNetworkId === n.id) {
                              setSelectedNetworkId(next[0]?.id ?? "");
                            }
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  );
                })
              )}
            </Stack>
          </ScrollArea>
        </Card>

        {/* Right panel: selected network detail + grouped results */}
        <Stack style={{ gridColumn: "span 8" }} gap="md">
          <Card withBorder radius="lg" p="lg">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text c="dimmed" size="sm">
                  Red seleccionada
                </Text>
                <Title order={4} style={{ letterSpacing: -0.2 }}>
                  {selectedNetwork?.name ?? "—"}
                </Title>
                <Text c="dimmed" size="sm">
                  {selectedNetwork?.cidr ?? "Crea o selecciona una red para ver detalles."}
                </Text>
              </Box>

              <Group gap="xs">
                <Button
                  size="sm"
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={scanMutation.isPending}
                  disabled={!canScan}
                  onClick={() => scanMutation.mutate()}
                >
                  Escanear
                </Button>

                <Button
                  size="sm"
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  disabled={!hosts.length}
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
                      ...hosts.map((h) =>
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
                  Exportar CSV
                </Button>
              </Group>
            </Group>

            <Divider my="md" />

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <Card withBorder radius="md" p="md">
                <Group justify="space-between">
                  <Text c="dimmed" size="sm">
                    Hosts
                  </Text>
                  <Badge variant="light">Total</Badge>
                </Group>
                <Text fw={700} fz={26} style={{ letterSpacing: -0.4 }}>
                  <NumberFormatter thousandSeparator value={counts.total} />
                </Text>
                <Text c="dimmed" size="sm">
                  Filtrados: <NumberFormatter thousandSeparator value={filteredHosts.length} />
                </Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text c="dimmed" size="sm">
                      Estado
                    </Text>
                    <Text fw={700} fz={26} style={{ letterSpacing: -0.4 }}>
                      <NumberFormatter
                        thousandSeparator
                        value={counts.authenticated + counts.identified}
                      />
                    </Text>
                    <Text c="dimmed" size="sm">
                      Auth + Id
                    </Text>
                  </Stack>
                  <RingProgress
                    size={72}
                    thickness={10}
                    sections={[
                      {
                        value: counts.total ? (counts.authenticated / counts.total) * 100 : 0,
                        color: "green",
                      },
                      {
                        value: counts.total ? (counts.identified / counts.total) * 100 : 0,
                        color: "blue",
                      },
                    ]}
                  />
                </Group>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text c="dimmed" size="sm">
                  Protocolos
                </Text>
                <Text fw={700} fz={26} style={{ letterSpacing: -0.4 }}>
                  <NumberFormatter thousandSeparator value={protocols.length} />
                </Text>
                <Text c="dimmed" size="sm">
                  Top: {protocols[0]?.[0] ?? "-"}
                </Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text c="dimmed" size="sm">
                  Puertos
                </Text>
                <Text fw={700} fz={26} style={{ letterSpacing: -0.4 }}>
                  <NumberFormatter thousandSeparator value={ports.length} />
                </Text>
                <Text c="dimmed" size="sm">
                  Top: {ports[0]?.[0] ?? "-"}
                </Text>
              </Card>
            </SimpleGrid>
          </Card>

          <Card withBorder radius="lg" p="lg">
            <Tabs defaultValue="hosts" variant="outline" radius="lg">
              <Tabs.List>
                <Tabs.Tab value="hosts">Hosts</Tabs.Tab>
                <Tabs.Tab value="protocols">Protocolos</Tabs.Tab>
                <Tabs.Tab value="ports">Puertos</Tabs.Tab>
                <Tabs.Tab value="vendors">Fabricantes</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="hosts" pt="md">
                <ScrollArea>
                  <Table highlightOnHover withTableBorder verticalSpacing="sm" striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>IP</Table.Th>
                        <Table.Th>Puertos</Table.Th>
                        <Table.Th>Protocolo</Table.Th>
                        <Table.Th>Fabricante</Table.Th>
                        <Table.Th>Modelo</Table.Th>
                        <Table.Th>Firmware</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Credencial</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredHosts.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Text c="dimmed">
                              {scanMutation.isPending
                                ? "Escaneando…"
                                : "Sin resultados. Selecciona una red y lanza un escaneo."}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        filteredHosts
                          .slice()
                          .sort((a, b) => a.ip.localeCompare(b.ip))
                          .map((h) => (
                            <Table.Tr key={h.ip}>
                              <Table.Td>{h.ip}</Table.Td>
                              <Table.Td>{(h.openPorts ?? []).join(", ")}</Table.Td>
                              <Table.Td>{h.protocol ?? "-"}</Table.Td>
                              <Table.Td>{h.manufacturer ?? "-"}</Table.Td>
                              <Table.Td>{h.model ?? "-"}</Table.Td>
                              <Table.Td>{h.firmware ?? "-"}</Table.Td>
                              <Table.Td>{statusBadge(h.status)}</Table.Td>
                              <Table.Td>{h.credentialUsername ?? "-"}</Table.Td>
                            </Table.Tr>
                          ))
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Tabs.Panel>

              <Tabs.Panel value="protocols" pt="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {protocols.slice(0, 12).map(([k, v]) => (
                    <Card key={k} withBorder radius="md" p="md">
                      <Group justify="space-between">
                        <Text fw={600}>{k}</Text>
                        <Badge variant="light">
                          <NumberFormatter thousandSeparator value={v} />
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        {counts.total ? Math.round((v / counts.total) * 100) : 0}% del total
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>

              <Tabs.Panel value="ports" pt="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {ports.slice(0, 14).map(([k, v]) => (
                    <Card key={k} withBorder radius="md" p="md">
                      <Group justify="space-between">
                        <Text fw={600}>:{k}</Text>
                        <Badge variant="light">
                          <NumberFormatter thousandSeparator value={v} />
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        Presente en {counts.total ? Math.round((v / counts.total) * 100) : 0}% de hosts
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>

              <Tabs.Panel value="vendors" pt="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {manufacturers.slice(0, 12).map(([k, v]) => (
                    <Card key={k} withBorder radius="md" p="md">
                      <Group justify="space-between">
                        <Text fw={600}>{k}</Text>
                        <Badge variant="light">
                          <NumberFormatter thousandSeparator value={v} />
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        {counts.total ? Math.round((v / counts.total) * 100) : 0}% del total
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
