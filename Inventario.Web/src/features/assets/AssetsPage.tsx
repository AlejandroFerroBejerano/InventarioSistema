import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../app/i18n/AppI18nContext";
import { getAssets, type SystemAssetListItemDto } from "../../api/assets";
import { getInstallations, createInstallation } from "../../api/installations";
import { getScanRuns } from "../../api/scanRuns";
import { useSelectedInstallation } from "../installations/useSelectedInstallation";
import { InstallationPicker } from "../installations/components/InstallationPicker";

function statusBadge(
  status: string | null | undefined,
  t: (spanish: string, english: string) => string
) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "authenticated") {
    return <Badge color="green" variant="light">{t("Autenticado", "Authenticated")}</Badge>;
  }
  if (normalized === "identified") {
    return <Badge color="blue" variant="light">{t("Identificado", "Identified")}</Badge>;
  }
  if (normalized === "noports") {
    return <Badge color="gray" variant="light">NoPorts</Badge>;
  }
  if (!status) return <Text c="dimmed">-</Text>;
  return <Badge color="yellow" variant="light">{status}</Badge>;
}

export function AssetsPage() {
  const { t, formatDateTime } = useI18n();
  const [filter, setFilter] = useState("");
  const { selectedAbonadoMm, setSelectedAbonadoMm } = useSelectedInstallation();
  const qc = useQueryClient();

  const installationsQuery = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
  });

  const createInstallationMutation = useMutation({
    mutationFn: createInstallation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["installations"] });
      notifications.show({
        title: t("Instalacion creada", "Installation created"),
        message: t("Ya puedes seleccionarla.", "You can select it now."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error creando instalacion", "Error creating installation"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["assets", selectedAbonadoMm],
    queryFn: () => getAssets(selectedAbonadoMm!),
    enabled: !!selectedAbonadoMm,
  });

  const scanRunsQuery = useQuery({
    queryKey: ["scanruns", selectedAbonadoMm, "assets-page"],
    queryFn: () => getScanRuns(selectedAbonadoMm!),
    enabled: !!selectedAbonadoMm,
  });

  const data = assetsQuery.data ?? [];

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return data;

    return data.filter((asset) => {
      const haystack = [
        asset.ipAddress,
        (asset.openPortsList ?? []).join(","),
        asset.status ?? "",
        asset.protocol ?? "",
        asset.manufacturer ?? "",
        asset.model ?? "",
        asset.firmware ?? "",
        asset.serialNumber ?? "",
        asset.category ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [data, filter]);

  const rows = useMemo(() => {
    if (!filtered.length) return null;

    return filtered.map((asset: SystemAssetListItemDto) => (
      <Table.Tr key={asset.ipAddress}>
        <Table.Td>{asset.ipAddress}</Table.Td>
        <Table.Td>{asset.category ?? "-"}</Table.Td>
        <Table.Td>{(asset.openPortsList ?? []).join(", ")}</Table.Td>
        <Table.Td>{asset.protocol ?? "-"}</Table.Td>
        <Table.Td>{asset.manufacturer ?? "-"}</Table.Td>
        <Table.Td>{asset.model ?? "-"}</Table.Td>
        <Table.Td>{asset.firmware ?? "-"}</Table.Td>
        <Table.Td>{asset.serialNumber ?? "-"}</Table.Td>
        <Table.Td>{statusBadge(asset.status, t)}</Table.Td>
        <Table.Td>{formatDateTime(asset.lastSeenAt)}</Table.Td>
      </Table.Tr>
    ));
  }, [filtered, formatDateTime]);

  const emptyStateMessage = useMemo(() => {
    if (assetsQuery.isFetching) return t("Cargando...", "Loading...");
    if (!selectedAbonadoMm) {
      return t("Selecciona un abonado para ver su inventario.", "Select an account to view its inventory.");
    }
    if (assetsQuery.isError) {
      return t("No se pudieron cargar los activos de este abonado.", "Could not load assets for this account.");
    }
    if (data.length > 0) {
      return t("No hay activos que coincidan con el filtro actual.", "No assets match the current filter.");
    }
    if (scanRunsQuery.isLoading || scanRunsQuery.isFetching) {
      return t(
        "No hay activos todavia. Comprobando el historico de escaneos...",
        "No assets yet. Checking scan history..."
      );
    }
    if (scanRunsQuery.isError) {
      return t("No hay activos cargados para este abonado.", "No assets have been loaded for this account.");
    }

    const latestRun = (scanRunsQuery.data ?? [])[0];
    if (!latestRun) {
      return t(
        "No hay activos ni ejecuciones de escaneo para este abonado.",
        "There are no assets or scan runs for this account."
      );
    }

    const applicableHosts = latestRun.authenticatedCount + latestRun.identifiedCount;
    if (applicableHosts > 0) {
      return t(
        "Este abonado tiene escaneos con resultados, pero aun no se han cargado al inventario. Ve a Historico y usa Apply to Inventory.",
        "This account has scan results, but they have not been loaded into inventory yet. Go to History and use Apply to Inventory."
      );
    }

    if (latestRun.totalHosts === 0) {
      return t(
        "No hay activos porque los escaneos de este abonado no encontraron ningun host.",
        "There are no assets because scans for this account did not find any hosts."
      );
    }

    if (latestRun.noPortsCount === latestRun.totalHosts) {
      return t(
        "No hay activos porque el ultimo escaneo solo devolvio hosts con NoPorts. Esos resultados no se cargan al inventario.",
        "There are no assets because the latest scan only returned NoPorts hosts. Those results are not loaded into inventory."
      );
    }

    return t(
      "No hay activos porque los escaneos de este abonado no produjeron hosts aplicables al inventario.",
      "There are no assets because scans for this account did not produce hosts that can be applied to inventory."
    );
  }, [
    assetsQuery.isError,
    assetsQuery.isFetching,
    data.length,
    scanRunsQuery.data,
    scanRunsQuery.isError,
    scanRunsQuery.isFetching,
    scanRunsQuery.isLoading,
    selectedAbonadoMm,
    t,
  ]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>{t("Activos", "Assets")}</Title>
            <Text c="dimmed">
              {t(
                "Inventario persistido en base de datos (SystemAssets).",
                "Inventory persisted in the database (SystemAssets)."
              )}
            </Text>
          </div>

          <Button
            loading={assetsQuery.isFetching || scanRunsQuery.isFetching}
            disabled={!selectedAbonadoMm}
            onClick={async () => {
              try {
                await Promise.all([assetsQuery.refetch(), scanRunsQuery.refetch()]);
              } catch (error: any) {
                notifications.show({
                  title: t("Error al cargar activos", "Error loading assets"),
                  message: error?.message ?? t("Error desconocido", "Unknown error"),
                  color: "red",
                });
              }
            }}
          >
            {t("Cargar", "Load")}
          </Button>
        </Group>

        <Stack gap="sm" mt="md">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
          />

          <TextInput
            label={t("Filtro", "Filter")}
            placeholder={t(
              "IP / fabricante / modelo / serial / estado...",
              "IP / manufacturer / model / serial / status..."
            )}
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
          />
        </Stack>

        <Group mt="md" gap="xs">
          <Badge variant="light">
            {filtered.length} {t("visibles", "visible")}
          </Badge>
          <Badge color="green" variant="light">
            {filtered.filter((item) => (item.status ?? "").toLowerCase() === "authenticated").length}{" "}
            auth
          </Badge>
          <Badge color="blue" variant="light">
            {filtered.filter((item) => (item.status ?? "").toLowerCase() === "identified").length} id
          </Badge>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>IP</Table.Th>
                <Table.Th>{t("Categoria", "Category")}</Table.Th>
                <Table.Th>{t("Puertos", "Ports")}</Table.Th>
                <Table.Th>{t("Protocolo", "Protocol")}</Table.Th>
                <Table.Th>{t("Fabricante", "Manufacturer")}</Table.Th>
                <Table.Th>{t("Modelo", "Model")}</Table.Th>
                <Table.Th>{t("Firmware", "Firmware")}</Table.Th>
                <Table.Th>{t("Serial", "Serial")}</Table.Th>
                <Table.Th>{t("Estado", "Status")}</Table.Th>
                <Table.Th>{t("Ultima vez visto", "Last seen")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows ?? (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Text c="dimmed">{emptyStateMessage}</Text>
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
