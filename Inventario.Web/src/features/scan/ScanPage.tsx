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
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconChevronsLeft,
  IconChevronsRight,
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

import {
  getNetworks,
  createNetwork,
  deleteNetwork,
  getNetworkDeletePreview,
  type NetworkDeletePreviewDto,
  type NetworkDto,
} from "../../api/networks";

import {
  deleteScanRun,
  exportScanRunCsv,
  getScanRuns,
  getScanRunHosts,
  type ScanRunListItem,
  type ScanHostResultDto,
} from "../../api/scanRuns";

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
  downloadBlobFile(filename, blob);
}

function downloadBlobFile(filename: string, blob: Blob) {
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

  // -----------------------------
  // Networks (desde backend)
  // -----------------------------
  const networksQuery = useQuery({
    queryKey: ["networks", selectedAbonadoMm],
    queryFn: () => getNetworks((selectedAbonadoMm ?? "").trim()),
    enabled: Boolean((selectedAbonadoMm ?? "").trim()),
  });

  const [selectedNetworkId, setSelectedNetworkId] = useState<number | null>(null);

  // Al cambiar de instalación o al cargar redes, seleccionar la primera si no hay selección
  useEffect(() => {
    const list = networksQuery.data ?? [];
    if (!list.length) {
      setSelectedNetworkId(null);
      return;
    }

    // Si la selección actual no existe en la nueva lista, seleccionamos la primera
    if (selectedNetworkId == null || !list.some((n) => n.id === selectedNetworkId)) {
      setSelectedNetworkId(list[0].id);
    }
  }, [networksQuery.data, selectedAbonadoMm]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNetwork: NetworkDto | null = useMemo(() => {
    const list = networksQuery.data ?? [];
    return list.find((n) => n.id === selectedNetworkId) ?? null;
  }, [networksQuery.data, selectedNetworkId]);

  const [createOpen, createModal] = useDisclosure(false);
  const [networkDeleteOpen, networkDeleteModal] = useDisclosure(false);
  const [newName, setNewName] = useState("");
  const [newCidr, setNewCidr] = useState("192.168.1.0/24");
  const [networkToDelete, setNetworkToDelete] = useState<NetworkDto | null>(null);
  const [networkDeletePreview, setNetworkDeletePreview] =
    useState<NetworkDeletePreviewDto | null>(null);
  const [networkDeleteConfirmation, setNetworkDeleteConfirmation] = useState("");
  const [previewingNetworkId, setPreviewingNetworkId] = useState<number | null>(null);
  const [deletingNetworkId, setDeletingNetworkId] = useState<number | null>(null);
  const [networksCompact, setNetworksCompact] = useState(false);
  const isMdUp = useMediaQuery("(min-width: 62em)");

  const createNetworkMutation = useMutation({
    mutationFn: async () => {
      const abonado = (selectedAbonadoMm ?? "").trim();
      return createNetwork(abonado, newName.trim(), newCidr.trim(), true);
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ["networks", selectedAbonadoMm] });
      setSelectedNetworkId(created.id);
      setNewName("");
      setNewCidr("192.168.1.0/24");
      createModal.close();
      notifications.show({
        title: "Red creada",
        message: "La red se guardó correctamente.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error creando red",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const networkDeletePreviewMutation = useMutation({
    mutationFn: (id: number) => getNetworkDeletePreview(id),
    onMutate: (id) => {
      setPreviewingNetworkId(id);
    },
    onSuccess: (preview) => {
      setNetworkDeletePreview(preview);
      networkDeleteModal.open();
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error obteniendo vista previa",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
    onSettled: () => {
      setPreviewingNetworkId(null);
    },
  });

  const deleteNetworkMutation = useMutation({
    mutationFn: async (payload: { id: number; confirmation: string }) =>
      deleteNetwork(payload.id, payload.confirmation),
    onMutate: ({ id }) => {
      setDeletingNetworkId(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["networks", selectedAbonadoMm] });
      await qc.invalidateQueries({ queryKey: ["scanruns", selectedAbonadoMm] });
      setSelectedScanRunId(null);
      setNetworkDeleteConfirmation("");
      setNetworkDeletePreview(null);
      setNetworkToDelete(null);
      networkDeleteModal.close();
      notifications.show({
        title: "Red eliminada",
        message: "Se eliminó correctamente.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error eliminando red",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
    onSettled: () => {
      setDeletingNetworkId(null);
    },
  });

  // -----------------------------
  // Historial ScanRuns
  // -----------------------------
  const scanRunsQuery = useQuery({
    queryKey: ["scanruns", selectedAbonadoMm],
    queryFn: () => getScanRuns((selectedAbonadoMm ?? "").trim()),
    enabled: Boolean((selectedAbonadoMm ?? "").trim()),
  });

  const [selectedScanRunId, setSelectedScanRunId] = useState<number | null>(null);
  const [scanRunDeleteOpen, scanRunDeleteModal] = useDisclosure(false);
  const [scanRunToDelete, setScanRunToDelete] = useState<ScanRunListItem | null>(null);
  const [scanRunDeleteConfirmation, setScanRunDeleteConfirmation] = useState("");
  const [exportingScanRunId, setExportingScanRunId] = useState<number | null>(null);
  const [deletingScanRunId, setDeletingScanRunId] = useState<number | null>(null);
  const [executionsCompact, setExecutionsCompact] = useState(false);

  const scanRunHostsQuery = useQuery({
    queryKey: ["scanrun-hosts", selectedScanRunId],
    queryFn: () => getScanRunHosts(selectedScanRunId!),
    enabled: selectedScanRunId != null,
  });

  const exportScanRunMutation = useMutation({
    mutationFn: (scanRunId: number) => exportScanRunCsv(scanRunId),
    onMutate: (scanRunId) => {
      setExportingScanRunId(scanRunId);
    },
    onSuccess: ({ blob, filename }) => {
      downloadBlobFile(filename, blob);
      notifications.show({
        title: "CSV exportado",
        message: "La descarga se inició correctamente.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error exportando CSV",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
    onSettled: () => {
      setExportingScanRunId(null);
    },
  });

  const deleteScanRunMutation = useMutation({
    mutationFn: (payload: { id: number; confirmation: string }) =>
      deleteScanRun(payload.id, payload.confirmation),
    onMutate: ({ id }) => {
      setDeletingScanRunId(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scanruns", selectedAbonadoMm] });
      setSelectedScanRunId(null);
      setScanRunDeleteConfirmation("");
      setScanRunToDelete(null);
      scanRunDeleteModal.close();
      notifications.show({
        title: "Ejecución eliminada",
        message: "Se eliminó el histórico seleccionado.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error eliminando ejecución",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
    onSettled: () => {
      setDeletingScanRunId(null);
    },
  });

  // -----------------------------
  // Escaneo
  // -----------------------------
  const [filter, setFilter] = useState("");

  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const canScan = Boolean((selectedAbonadoMm ?? "").trim() && selectedNetwork?.id);

  const scanMutation = useMutation({
    mutationFn: () =>
      startScan({
        abonadoMm: (selectedAbonadoMm ?? "").trim(),
        // Mantengo networkCidr por compatibilidad, pero lo fiable es networkId
        networkCidr: (selectedNetwork?.cidr ?? "").trim(),
        networkId: selectedNetwork?.id ?? null,

        applyMode: "NoDegrade",
        connectTimeoutMs: 800,
        maxConcurrency: 200,
        useSsdp: true,
        ssdpListenMs: 1500,
      } as any),
    onMutate: () => {
      setStartedAtMs(Date.now());
      setElapsedMs(0);
    },
    onSuccess: async () => {
      notifications.show({
        title: "Escaneo terminado",
        message: "Se han recibido resultados del backend.",
      });

      // Refrescar histórico automáticamente
      await qc.invalidateQueries({ queryKey: ["scanruns", selectedAbonadoMm] });
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
    // Tu regla actual: "Host contabilizable = protocol no vacío"
    const countableHosts = hosts.filter((h) => (h.protocol ?? "").trim().length > 0);

    const authenticated = countableHosts.filter(
      (h) => (h.status ?? "").toLowerCase() === "authenticated"
    ).length;

    const identified = countableHosts.filter(
      (h) => (h.status ?? "").toLowerCase() === "identified"
    ).length;

    const noports = countableHosts.filter(
      (h) => (h.status ?? "").toLowerCase() === "noports"
    ).length;

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

  const openNetworkDeleteDialog = (network: NetworkDto) => {
    setNetworkToDelete(network);
    setNetworkDeletePreview(null);
    setNetworkDeleteConfirmation("");
    networkDeletePreviewMutation.mutate(network.id);
  };

  const openScanRunDeleteDialog = (scanRun: ScanRunListItem) => {
    setScanRunToDelete(scanRun);
    setScanRunDeleteConfirmation("");
    scanRunDeleteModal.open();
  };

  const networksPanelSpan = networksCompact ? 1 : 3;
  const detailPanelSpan = networksCompact ? 11 : 9;

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
              loading={createNetworkMutation.isPending}
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
                if (!(selectedAbonadoMm ?? "").trim()) {
                  notifications.show({
                    title: "Falta instalación",
                    message: "Selecciona una instalación antes de crear redes.",
                    color: "red",
                  });
                  return;
                }

                createNetworkMutation.mutate();
              }}
            >
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={networkDeleteOpen}
        onClose={() => {
          if (!deleteNetworkMutation.isPending) {
            networkDeleteModal.close();
            setNetworkDeleteConfirmation("");
            setNetworkDeletePreview(null);
            setNetworkToDelete(null);
          }
        }}
        title="Eliminar red"
        centered
      >
        <Stack>
          <Text>
            Se eliminará esta red y sus resultados asociados.
            <br />
            El inventario NO se modificará.
          </Text>

          <Card withBorder radius="md" p="sm">
            <Text fw={600}>{networkDeletePreview?.networkName ?? networkToDelete?.name ?? "-"}</Text>
            <Text c="dimmed" size="sm">
              {networkDeletePreview?.networkCidr ?? networkToDelete?.cidr ?? "-"}
            </Text>
            <Text mt="sm" size="sm">
              ScanRuns a borrar:{" "}
              <Text span fw={700}>
                <NumberFormatter thousandSeparator value={networkDeletePreview?.scanRunsToDelete ?? 0} />
              </Text>
            </Text>
            <Text size="sm">
              HostResults a borrar:{" "}
              <Text span fw={700}>
                <NumberFormatter
                  thousandSeparator
                  value={networkDeletePreview?.hostResultsToDelete ?? 0}
                />
              </Text>
            </Text>
          </Card>

          <TextInput
            label="Escribe delete para confirmar"
            placeholder="delete"
            value={networkDeleteConfirmation}
            onChange={(e) => setNetworkDeleteConfirmation(e.currentTarget.value)}
            disabled={deleteNetworkMutation.isPending}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                networkDeleteModal.close();
                setNetworkDeleteConfirmation("");
                setNetworkDeletePreview(null);
                setNetworkToDelete(null);
              }}
              disabled={deleteNetworkMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteNetworkMutation.isPending}
              disabled={
                !networkToDelete ||
                networkDeleteConfirmation.trim().toLowerCase() !== "delete"
              }
              onClick={() => {
                if (!networkToDelete) return;
                deleteNetworkMutation.mutate({
                  id: networkToDelete.id,
                  confirmation: "delete",
                });
              }}
            >
              Eliminar red
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={scanRunDeleteOpen}
        onClose={() => {
          if (!deleteScanRunMutation.isPending) {
            scanRunDeleteModal.close();
            setScanRunDeleteConfirmation("");
            setScanRunToDelete(null);
          }
        }}
        title="Eliminar ejecución"
        centered
      >
        <Stack>
          <Text>
            Se eliminará esta ejecución y sus resultados.
            <br />
            El inventario NO se modificará.
          </Text>

          <Card withBorder radius="md" p="sm">
            <Text fw={600}>Run #{scanRunToDelete?.id ?? "-"}</Text>
            <Text size="sm" c="dimmed">
              Inicio:{" "}
              {scanRunToDelete?.startedAt
                ? new Date(scanRunToDelete.startedAt).toLocaleString()
                : "-"}
            </Text>
            <Text size="sm" c="dimmed">
              Red: {scanRunToDelete?.networkCidr ?? "-"}
            </Text>
          </Card>

          <TextInput
            label="Escribe delete para confirmar"
            placeholder="delete"
            value={scanRunDeleteConfirmation}
            onChange={(e) => setScanRunDeleteConfirmation(e.currentTarget.value)}
            disabled={deleteScanRunMutation.isPending}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                scanRunDeleteModal.close();
                setScanRunDeleteConfirmation("");
                setScanRunToDelete(null);
              }}
              disabled={deleteScanRunMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteScanRunMutation.isPending}
              disabled={
                !scanRunToDelete ||
                scanRunDeleteConfirmation.trim().toLowerCase() !== "delete"
              }
              onClick={() => {
                if (!scanRunToDelete) return;
                deleteScanRunMutation.mutate({
                  id: scanRunToDelete.id,
                  confirmation: "delete",
                });
              }}
            >
              Eliminar ejecución
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
              disabled={!Boolean((selectedAbonadoMm ?? "").trim())}
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
            onChange={(v) => {
              setSelectedAbonadoMm(v);
              // reset historial selection
              setSelectedScanRunId(null);
            }}
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
        <Card
          withBorder
          radius="lg"
          p="md"
          className="networks-panel"
          style={{
            gridColumn: `span ${networksPanelSpan}`,
            width: isMdUp && networksCompact ? 72 : undefined,
            minWidth: isMdUp && networksCompact ? 72 : undefined,
            maxWidth: isMdUp && networksCompact ? 72 : undefined,
            justifySelf: networksCompact ? "start" : undefined,
          }}
        >
          <ActionIcon
            className="sidebar-toggle"
            variant="light"
            radius="xl"
            size="sm"
            onClick={() => setNetworksCompact((v) => !v)}
            aria-label={networksCompact ? "Expandir panel de redes" : "Condensar panel de redes"}
          >
            {networksCompact ? <IconChevronsRight size={16} /> : <IconChevronsLeft size={16} />}
          </ActionIcon>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconNetwork size={18} />
              {!networksCompact && <Text fw={600}>Redes</Text>}
            </Group>
            {!networksCompact && (
              <ActionIcon
                variant="subtle"
                onClick={createModal.open}
                aria-label="Nueva red"
                disabled={!Boolean((selectedAbonadoMm ?? "").trim())}
              >
                <IconCirclePlus size={18} />
              </ActionIcon>
            )}
          </Group>

          {networksCompact ? (
            <Stack gap="xs" align="center">
              <ActionIcon
                variant="subtle"
                onClick={createModal.open}
                aria-label="Nueva red"
                disabled={!Boolean((selectedAbonadoMm ?? "").trim())}
              >
                <IconCirclePlus size={18} />
              </ActionIcon>
              {(networksQuery.data ?? []).map((n) => {
                const active = n.id === selectedNetworkId;
                return (
                  <Tooltip key={n.id} label={`${n.name} · ${n.cidr}`} position="right">
                    <ActionIcon
                      size="lg"
                      variant={active ? "light" : "subtle"}
                      color={active ? "indigo" : undefined}
                      onClick={() => setSelectedNetworkId(n.id)}
                      aria-label={`Seleccionar red ${n.name}`}
                    >
                      <IconNetwork size={16} />
                    </ActionIcon>
                  </Tooltip>
                );
              })}
            </Stack>
          ) : (
          <ScrollArea h={420} offsetScrollbars>
            <Stack gap={6}>
              {networksQuery.isLoading ? (
                <Text c="dimmed" size="sm">
                  Cargando redes…
                </Text>
              ) : (networksQuery.data?.length ?? 0) === 0 ? (
                <Text c="dimmed" size="sm">
                  No hay redes para esta instalación. Crea una para empezar.
                </Text>
              ) : (
                (networksQuery.data ?? []).map((n) => {
                  const active = n.id === selectedNetworkId;
                  return (
                    <Card
                      key={n.id}
                      withBorder
                      radius="md"
                      p="sm"
                      style={{
                        cursor: "pointer",
                        borderColor: active
                          ? "light-dark(var(--mantine-color-indigo-5), var(--mantine-color-indigo-4))"
                          : undefined,
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
                          loading={previewingNetworkId === n.id || deletingNetworkId === n.id}
                          disabled={networkDeletePreviewMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            openNetworkDeleteDialog(n);
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
          )}
        </Card>

        {/* Right panel: selected network detail + grouped results */}
        <Stack style={{ gridColumn: `span ${detailPanelSpan}` }} gap="md">
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

                    downloadTextFile(
                      `${exportBaseName}.csv`,
                      lines.join("\n"),
                      "text/csv;charset=utf-8"
                    );
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
                <Tabs.Tab value="history">Histórico</Tabs.Tab>
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

              {/* -----------------------------
                  HISTÓRICO
              ------------------------------ */}
              <Tabs.Panel value="history" pt="md">
                {scanRunsQuery.isLoading ? (
                  <Text c="dimmed">Cargando histórico…</Text>
                ) : (scanRunsQuery.data?.length ?? 0) === 0 ? (
                  <Text c="dimmed">Sin ejecuciones aún.</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, md: 12 }} spacing="md">
                    <Card
                      withBorder
                      radius="md"
                      p="md"
                      style={{ gridColumn: executionsCompact ? "span 3" : "span 5" }}
                    >
                      <Group justify="space-between" mb="sm">
                        <Text fw={600}>Ejecuciones</Text>
                        <Group gap={6}>
                          <Badge variant="light">
                            <NumberFormatter
                              thousandSeparator
                              value={scanRunsQuery.data?.length ?? 0}
                            />
                          </Badge>
                          <ActionIcon
                            variant="light"
                            aria-label={
                              executionsCompact
                                ? "Expandir columnas de ejecuciones"
                                : "Condensar columnas de ejecuciones"
                            }
                            onClick={() => setExecutionsCompact((v) => !v)}
                          >
                            {executionsCompact ? (
                              <IconChevronsRight size={16} />
                            ) : (
                              <IconChevronsLeft size={16} />
                            )}
                          </ActionIcon>
                        </Group>
                      </Group>

                      <ScrollArea h={280}>
                        <Table highlightOnHover withTableBorder striped>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Inicio</Table.Th>
                              {!executionsCompact && <Table.Th>Red</Table.Th>}
                              {!executionsCompact && <Table.Th>Auth</Table.Th>}
                              {!executionsCompact && <Table.Th>Id</Table.Th>}
                              {!executionsCompact && <Table.Th>NoPorts</Table.Th>}
                              <Table.Th>Acciones</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {(scanRunsQuery.data ?? []).map((r: ScanRunListItem) => (
                              <Table.Tr
                                key={r.id}
                                style={{
                                  cursor: "pointer",
                                  background:
                                    selectedScanRunId === r.id
                                      ? "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))"
                                      : undefined,
                                }}
                                onClick={() => setSelectedScanRunId(r.id)}
                              >
                                <Table.Td>{new Date(r.startedAt).toLocaleString()}</Table.Td>
                                {!executionsCompact && <Table.Td>{r.networkCidr}</Table.Td>}
                                {!executionsCompact && <Table.Td>{r.authenticatedCount}</Table.Td>}
                                {!executionsCompact && <Table.Td>{r.identifiedCount}</Table.Td>}
                                {!executionsCompact && <Table.Td>{r.noPortsCount}</Table.Td>}
                                <Table.Td>
                                  <Group gap={6} wrap="nowrap">
                                    <ActionIcon
                                      variant="subtle"
                                      aria-label="Exportar CSV"
                                      loading={exportingScanRunId === r.id}
                                      disabled={deleteScanRunMutation.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        exportScanRunMutation.mutate(r.id);
                                      }}
                                    >
                                      <IconDownload size={16} />
                                    </ActionIcon>
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      aria-label="Eliminar ejecución"
                                      loading={deletingScanRunId === r.id}
                                      disabled={deleteScanRunMutation.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openScanRunDeleteDialog(r);
                                      }}
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </Card>

                    <Card
                      withBorder
                      radius="md"
                      p="md"
                      style={{ gridColumn: executionsCompact ? "span 9" : "span 7" }}
                    >
                      <Text fw={600} mb="sm">
                        Hosts{" "}
                        {selectedScanRunId != null ? `(Run #${selectedScanRunId})` : ""}
                      </Text>

                      {selectedScanRunId == null ? (
                        <Text c="dimmed">Selecciona una ejecución.</Text>
                      ) : scanRunHostsQuery.isLoading ? (
                        <Text c="dimmed">Cargando hosts…</Text>
                      ) : scanRunHostsQuery.isError ? (
                        <Text c="red">Error cargando hosts.</Text>
                      ) : (
                        <ScrollArea h={280}>
                          <Table highlightOnHover withTableBorder striped>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>IP</Table.Th>
                                <Table.Th>Puertos</Table.Th>
                                <Table.Th>Protocolo</Table.Th>
                                <Table.Th>Fabricante</Table.Th>
                                <Table.Th>Modelo</Table.Th>
                                <Table.Th>Status</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {(scanRunHostsQuery.data ?? []).map((h: ScanHostResultDto) => (
                                <Table.Tr key={h.ipAddress}>
                                  <Table.Td>{h.ipAddress}</Table.Td>
                                  <Table.Td>{(h.openPorts ?? []).join(", ")}</Table.Td>
                                  <Table.Td>{h.protocol ?? "-"}</Table.Td>
                                  <Table.Td>{h.manufacturer ?? "-"}</Table.Td>
                                  <Table.Td>{h.model ?? "-"}</Table.Td>
                                  <Table.Td>{h.status}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </ScrollArea>
                      )}
                    </Card>
                  </SimpleGrid>
                )}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
