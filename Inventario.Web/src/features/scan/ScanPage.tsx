import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Table,
  ScrollArea,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";

import { startScan } from "../../api/scans";
import type { ScanResponseDto } from "../../api/scans";

export function ScanPage() {
  const [abonadoMm, setAbonadoMm] = useState("000000");
  const [networkCidr, setNetworkCidr] = useState("192.168.1.0/24");

  const mutation = useMutation({
    mutationFn: () =>
      startScan({
        abonadoMm: abonadoMm.trim(),
        networkCidr: networkCidr.trim(),
        connectTimeoutMs: 800,
        maxConcurrency: 200,
        useSsdp: true,
        ssdpListenMs: 1500,
      }),
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

  const result: ScanResponseDto | null = mutation.data ?? null;

  const rows = useMemo(() => {
    if (!result?.hosts?.length) return null;

    return result.hosts.map((h) => (
      <Table.Tr key={h.ip}>
        <Table.Td>{h.ip}</Table.Td>
        <Table.Td>{(h.openPorts ?? []).join(", ")}</Table.Td>
        <Table.Td>{h.protocol ?? "-"}</Table.Td>
        <Table.Td>{h.manufacturer ?? "-"}</Table.Td>
        <Table.Td>{h.model ?? "-"}</Table.Td>
        <Table.Td>{h.firmware ?? "-"}</Table.Td>
        <Table.Td>{h.serialNumber ?? "-"}</Table.Td>
        <Table.Td>
          {h.status ? <Badge variant="light">{h.status}</Badge> : <Text c="dimmed">-</Text>}
        </Table.Td>
        <Table.Td>{h.credentialUsername ?? "-"}</Table.Td>
      </Table.Tr>
    ));
  }, [result]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>Escaneo</Title>
            <Text c="dimmed">
              Llama a <code>POST /api/scans</code> usando el proxy de Vite.
            </Text>
          </div>

          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Iniciar escaneo
          </Button>
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
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between">
          <Title order={4}>Resultados</Title>
          {result?.hosts ? (
            <Text c="dimmed">{result.hosts.length} hosts</Text>
          ) : (
            <Text c="dimmed">Sin resultados</Text>
          )}
        </Group>

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
