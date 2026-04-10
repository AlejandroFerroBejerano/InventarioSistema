import { useDebouncedValue } from "@mantine/hooks";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../app/i18n/AppI18nContext";
import {
  downloadAuditCsv,
  downloadAuditJson,
  getAuditEvents,
  getSecurityAlerts,
  getSecuritySummary,
  type AuditEventDto,
  type SecurityAlertDto,
} from "../../api/auditEvents";

const takeOptions = ["50", "100", "200", "500"];
const alertWindowOptions = ["24", "72", "168"];

function severityColor(severity: string) {
  if (severity === "High") return "red";
  if (severity === "Medium") return "orange";
  return "blue";
}

export function AuditPage() {
  const { t, formatDateTime } = useI18n();
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromUtc, setFromUtc] = useState("");
  const [toUtc, setToUtc] = useState("");
  const [take, setTake] = useState("200");
  const [alertWindowHours, setAlertWindowHours] = useState("24");

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

  const summaryQuery = useQuery({
    queryKey: ["securitySummary", fromUtc, toUtc],
    queryFn: () =>
      getSecuritySummary({
        fromUtc: fromUtc || undefined,
        toUtc: toUtc || undefined,
      }),
  });

  const alertsQuery = useQuery({
    queryKey: ["securityAlerts", alertWindowHours],
    queryFn: () =>
      getSecurityAlerts({
        hours: Number(alertWindowHours),
        take: 100,
      }),
  });

  const events = useMemo<AuditEventDto[]>(() => auditQuery.data?.items ?? [], [auditQuery.data]);
  const alerts = useMemo<SecurityAlertDto[]>(() => alertsQuery.data ?? [], [alertsQuery.data]);

  async function onExportCsv() {
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
        title: t("Error exportando", "Export failed"),
        message: t("No se pudo descargar el CSV.", "Could not download CSV."),
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
        title: t("Error exportando", "Export failed"),
        message: t("No se pudo descargar el JSON.", "Could not download JSON."),
        color: "red",
      });
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md" wrap="wrap">
          <Title order={3}>{t("Auditoria y seguridad", "Audit and Security")}</Title>
          <Group gap="xs">
            <Button onClick={onExportCsv}>{t("Exportar CSV", "Export CSV")}</Button>
            <Button variant="light" onClick={onExportJson}>
              {t("Exportar JSON", "Export JSON")}
            </Button>
          </Group>
        </Group>

        <Group mb="md" gap="sm" wrap="wrap">
          <TextInput
            label={t("ActorId", "Actor ID")}
            value={actorId}
            onChange={(e) => setActorId(e.currentTarget.value)}
          />
          <TextInput label={t("Accion", "Action")} value={action} onChange={(e) => setAction(e.currentTarget.value)} />
          <TextInput
            label={t("Tipo de recurso", "Resource type")}
            value={resourceType}
            onChange={(e) => setResourceType(e.currentTarget.value)}
          />
          <TextInput
            label={t("Desde UTC", "From UTC")}
            value={fromUtc}
            onChange={(e) => setFromUtc(e.currentTarget.value)}
            placeholder="2026-03-15T00:00:00Z"
          />
          <TextInput
            label={t("Hasta UTC", "To UTC")}
            value={toUtc}
            onChange={(e) => setToUtc(e.currentTarget.value)}
            placeholder="2026-03-16T00:00:00Z"
          />
          <Select
            label={t("Filas", "Rows")}
            data={takeOptions}
            value={take}
            onChange={(value) => setTake(value ?? "200")}
          />
          <Select
            label={t("Ventana de alertas (h)", "Alerts window (h)")}
            data={alertWindowOptions}
            value={alertWindowHours}
            onChange={(value) => setAlertWindowHours(value ?? "24")}
          />
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("Eventos totales", "Total events")}
            </Text>
            <Title order={4}>{summaryQuery.data?.totalEvents ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("Inicios de sesion fallidos", "Failed logins")}
            </Text>
            <Title order={4}>{summaryQuery.data?.failedLogins ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("MFA deshabilitado", "MFA disabled")}
            </Text>
            <Title order={4}>{summaryQuery.data?.mfaDisabledEvents ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("Cambios de rol", "Role changes")}
            </Text>
            <Title order={4}>{summaryQuery.data?.roleChanges ?? "-"}</Title>
          </Card>
        </SimpleGrid>

        <Card withBorder mb="md" p="sm">
          <Text fw={600} mb={4}>
            {t("Acciones principales", "Top actions")}
          </Text>
          {summaryQuery.isLoading ? (
            <Text size="sm" c="dimmed">
              {t("Cargando resumen...", "Loading summary...")}
            </Text>
          ) : summaryQuery.data?.topActions?.length ? (
            <Group gap="xs">
              {summaryQuery.data.topActions.map((item) => (
                <Badge key={item.action} variant="light">
                  {item.action} ({item.count})
                </Badge>
              ))}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {t("No hay datos de resumen.", "No summary data.")}
            </Text>
          )}
        </Card>

        <Card withBorder mb="md" p="sm">
          <Text fw={600} mb={8}>
            {t("Alertas de seguridad", "Security alerts")}
          </Text>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Detectada", "Detected")}</Table.Th>
                <Table.Th>{t("Severidad", "Severity")}</Table.Th>
                <Table.Th>{t("Categoria", "Category")}</Table.Th>
                <Table.Th>{t("Titulo", "Title")}</Table.Th>
                <Table.Th>{t("Origen", "Source")}</Table.Th>
                <Table.Th>{t("Conteo", "Count")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {alertsQuery.isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>{t("Cargando alertas...", "Loading alerts...")}</Table.Td>
                </Table.Tr>
              ) : alerts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>{t("No hay alertas para la ventana seleccionada.", "No alerts for selected window.")}</Table.Td>
                </Table.Tr>
              ) : (
                alerts.map((alert) => (
                  <Table.Tr key={alert.id}>
                    <Table.Td>{formatDateTime(alert.detectedAtUtc)}</Table.Td>
                    <Table.Td>
                      <Badge color={severityColor(alert.severity)} variant="light">
                        {alert.severity}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{alert.category}</Table.Td>
                    <Table.Td>{alert.title}</Table.Td>
                    <Table.Td>{alert.actorId ?? alert.ipAddress ?? alert.resourceId ?? "-"}</Table.Td>
                    <Table.Td>{alert.count}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Card>

        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Fecha", "Timestamp")}</Table.Th>
              <Table.Th>{t("Actor", "Actor")}</Table.Th>
              <Table.Th>{t("Accion", "Action")}</Table.Th>
              <Table.Th>{t("Recurso", "Resource")}</Table.Th>
              <Table.Th>{t("Resultado", "Result")}</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>{t("Correlacion", "Correlation")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {auditQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>{t("Cargando eventos...", "Loading events...")}</Table.Td>
              </Table.Tr>
            ) : events.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>{t("No hay eventos.", "No events.")}</Table.Td>
              </Table.Tr>
            ) : (
              events.map((event) => (
                <Table.Tr key={event.id}>
                  <Table.Td>{formatDateTime(event.timestampUtc)}</Table.Td>
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
