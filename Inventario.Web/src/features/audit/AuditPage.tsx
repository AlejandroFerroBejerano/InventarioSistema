import { useDebouncedValue } from "@mantine/hooks";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import {
  downloadAuditCsv,
  downloadAuditJson,
  getAuditEvents,
  type AuditEventDto,
} from "../../api/auditEvents";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const takeOptions = ["50", "100", "200", "500"];

export function AuditPage() {
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromUtc, setFromUtc] = useState("");
  const [toUtc, setToUtc] = useState("");
  const [take, setTake] = useState("200");

  const [debouncedActorId] = useDebouncedValue(actorId, 300);
  const [debouncedAction] = useDebouncedValue(action, 300);
  const [debouncedResourceType] = useDebouncedValue(resourceType, 300);

  const auditQuery = useQuery({
    queryKey: ["auditEvents", debouncedActorId, debouncedAction, debouncedResourceType, fromUtc, toUtc, take],
    queryFn: () =>
      getAuditEvents({
        actorId: debouncedActorId,
        action: debouncedAction,
        resourceType: debouncedResourceType,
        fromUtc: fromUtc || undefined,
        toUtc: toUtc || undefined,
        skip: 0,
        take: Number(take),
      }),
  });

  const events = useMemo<AuditEventDto[]>(() => auditQuery.data?.items ?? [], [auditQuery.data]);

  async function onExport() {
    try {
      await downloadAuditCsv({
        actorId: debouncedActorId,
        action: debouncedAction,
        resourceType: debouncedResourceType,
        fromUtc: fromUtc || undefined,
        toUtc: toUtc || undefined,
      });
    } catch {
      notifications.show({
        title: "No se pudo exportar",
        message: "No fue posible descargar CSV.",
        color: "red",
      });
    }
  }

  async function onExportJson() {
    try {
      await downloadAuditJson({
        actorId: debouncedActorId,
        action: debouncedAction,
        resourceType: debouncedResourceType,
        fromUtc: fromUtc || undefined,
        toUtc: toUtc || undefined,
      });
    } catch {
      notifications.show({
        title: "No se pudo exportar",
        message: "No fue posible descargar JSON.",
        color: "red",
      });
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md" wrap="wrap">
          <Title order={3}>Auditoria</Title>
          <Group gap="xs">
            <Button onClick={onExport}>Exportar CSV</Button>
            <Button variant="light" onClick={onExportJson}>
              Exportar JSON
            </Button>
          </Group>
        </Group>

        <Group mb="md" gap="sm" wrap="wrap">
          <TextInput label="ActorId" value={actorId} onChange={(e) => setActorId(e.currentTarget.value)} />
          <TextInput label="Accion" value={action} onChange={(e) => setAction(e.currentTarget.value)} />
          <TextInput
            label="Recurso"
            value={resourceType}
            onChange={(e) => setResourceType(e.currentTarget.value)}
          />
          <TextInput
            label="Desde UTC"
            value={fromUtc}
            onChange={(e) => setFromUtc(e.currentTarget.value)}
            placeholder="2026-03-15T00:00:00Z"
          />
          <TextInput
            label="Hasta UTC"
            value={toUtc}
            onChange={(e) => setToUtc(e.currentTarget.value)}
            placeholder="2026-03-16T00:00:00Z"
          />
          <Select
            label="Resultados"
            data={takeOptions}
            value={take}
            onChange={(value) => setTake(value ?? "200")}
          />
        </Group>

        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Timestamp</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th>Accion</Table.Th>
              <Table.Th>Recurso</Table.Th>
              <Table.Th>Resultado</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>Correlation</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {auditQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>Cargando eventos...</Table.Td>
              </Table.Tr>
            ) : events.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>No hay eventos.</Table.Td>
              </Table.Tr>
            ) : (
              events.map((event) => (
                <Table.Tr key={event.id}>
                  <Table.Td>{formatDate(event.timestampUtc)}</Table.Td>
                  <Table.Td>{event.actorId}</Table.Td>
                  <Table.Td>{event.action}</Table.Td>
                  <Table.Td>
                    {event.resourceType} / {event.resourceId}
                  </Table.Td>
                  <Table.Td>{event.result}</Table.Td>
                  <Table.Td>{event.ipAddress ?? "-"}</Table.Td>
                  <Table.Td>{event.correlationId ?? "-"}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
