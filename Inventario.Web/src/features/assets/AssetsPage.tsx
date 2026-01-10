import { useMemo, useState } from "react";
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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";

import { getAssets, type SystemAssetListItemDto } from "../../api/assets";

function statusBadge(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "authenticated") return <Badge color="green" variant="light">Authenticated</Badge>;
  if (s === "identified") return <Badge color="blue" variant="light">Identified</Badge>;
  if (s === "noports") return <Badge color="gray" variant="light">NoPorts</Badge>;
  if (!status) return <Text c="dimmed">-</Text>;
  return <Badge color="yellow" variant="light">{status}</Badge>;
}

export function AssetsPage() {
  const [abonadoMm, setAbonadoMm] = useState("000000");
  const [filter, setFilter] = useState("");

  const query = useQuery({
    queryKey: ["assets", abonadoMm],
    queryFn: () => getAssets(abonadoMm),
    enabled: false, // manual
  });

  const data = query.data ?? [];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data;

    return data.filter((a) => {
      const haystack = [
        a.ipAddress,
        (a.openPortsList ?? []).join(","),
        a.status ?? "",
        a.protocol ?? "",
        a.manufacturer ?? "",
        a.model ?? "",
        a.firmware ?? "",
        a.serialNumber ?? "",
        a.category ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, filter]);

  const rows = useMemo(() => {
    if (!filtered.length) return null;

    return filtered.map((a: SystemAssetListItemDto) => (
      <Table.Tr key={a.ipAddress}>
        <Table.Td>{a.ipAddress}</Table.Td>
        <Table.Td>{a.category ?? "-"}</Table.Td>
        <Table.Td>{(a.openPortsList ?? []).join(", ")}</Table.Td>
        <Table.Td>{a.protocol ?? "-"}</Table.Td>
        <Table.Td>{a.manufacturer ?? "-"}</Table.Td>
        <Table.Td>{a.model ?? "-"}</Table.Td>
        <Table.Td>{a.firmware ?? "-"}</Table.Td>
        <Table.Td>{a.serialNumber ?? "-"}</Table.Td>
        <Table.Td>{statusBadge(a.status)}</Table.Td>
        <Table.Td>{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : "-"}</Table.Td>
      </Table.Tr>
    ));
  }, [filtered]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>Activos</Title>
            <Text c="dimmed">Inventario persistido en base de datos (SystemAssets).</Text>
          </div>

          <Button
            loading={query.isFetching}
            onClick={async () => {
              try {
                await query.refetch();
              } catch (err: any) {
                notifications.show({
                  title: "Error al cargar activos",
                  message: err?.message ?? "Error desconocido",
                  color: "red",
                });
              }
            }}
          >
            Cargar
          </Button>
        </Group>

        <Stack gap="sm" mt="md">
          <TextInput
            label="AbonadoMm"
            value={abonadoMm}
            onChange={(e) => setAbonadoMm(e.currentTarget.value)}
          />

          <TextInput
            label="Filtro"
            placeholder="IP / fabricante / modelo / serial / estado..."
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
          />
        </Stack>

        <Group mt="md" gap="xs">
          <Badge variant="light">{filtered.length} visibles</Badge>
          <Badge color="green" variant="light">
            {(filtered.filter((x) => (x.status ?? "").toLowerCase() === "authenticated").length)} auth
          </Badge>
          <Badge color="blue" variant="light">
            {(filtered.filter((x) => (x.status ?? "").toLowerCase() === "identified").length)} id
          </Badge>
        </Group>
      </Card>

      <Card withBorder radius="md" p="lg">
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>IP</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Puertos</Table.Th>
                <Table.Th>Protocolo</Table.Th>
                <Table.Th>Fabricante</Table.Th>
                <Table.Th>Modelo</Table.Th>
                <Table.Th>Firmware</Table.Th>
                <Table.Th>Serial</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last seen</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows ?? (
                <Table.Tr>
                  <Table.Td colSpan={10}>
                    <Text c="dimmed">
                      {query.isFetching
                        ? "Cargando..."
                        : "Sin datos. Escribe un abonadoMm y pulsa Cargar."}
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
