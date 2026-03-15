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
import {
  downloadAuditCsv,
  downloadAuditJson,
  getAuditEvents,
  getSecurityAlerts,
  getSecuritySummary,
  type AuditEventDto,
  type SecurityAlertDto,
} from "../../api/auditEvents";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const takeOptions = ["50", "100", "200", "500"];
const alertWindowOptions = ["24", "72", "168"];

function severityColor(severity: string) {
  if (severity === "High") return "red";
  if (severity === "Medium") return "orange";
  return "blue";
}

export function AuditPage() {
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
        title: "Export failed",
        message: "Could not download CSV.",
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
        title: "Export failed",
        message: "Could not download JSON.",
        color: "red",
      });
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md" wrap="wrap">
          <Title order={3}>Audit and Security</Title>
          <Group gap="xs">
            <Button onClick={onExportCsv}>Export CSV</Button>
            <Button variant="light" onClick={onExportJson}>
              Export JSON
            </Button>
          </Group>
        </Group>

        <Group mb="md" gap="sm" wrap="wrap">
          <TextInput label="ActorId" value={actorId} onChange={(e) => setActorId(e.currentTarget.value)} />
          <TextInput label="Action" value={action} onChange={(e) => setAction(e.currentTarget.value)} />
          <TextInput
            label="ResourceType"
            value={resourceType}
            onChange={(e) => setResourceType(e.currentTarget.value)}
          />
          <TextInput
            label="From UTC"
            value={fromUtc}
            onChange={(e) => setFromUtc(e.currentTarget.value)}
            placeholder="2026-03-15T00:00:00Z"
          />
          <TextInput
            label="To UTC"
            value={toUtc}
            onChange={(e) => setToUtc(e.currentTarget.value)}
            placeholder="2026-03-16T00:00:00Z"
          />
          <Select
            label="Rows"
            data={takeOptions}
            value={take}
            onChange={(value) => setTake(value ?? "200")}
          />
          <Select
            label="Alerts window (h)"
            data={alertWindowOptions}
            value={alertWindowHours}
            onChange={(value) => setAlertWindowHours(value ?? "24")}
          />
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Total events
            </Text>
            <Title order={4}>{summaryQuery.data?.totalEvents ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Failed logins
            </Text>
            <Title order={4}>{summaryQuery.data?.failedLogins ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              MFA disabled
            </Text>
            <Title order={4}>{summaryQuery.data?.mfaDisabledEvents ?? "-"}</Title>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Role changes
            </Text>
            <Title order={4}>{summaryQuery.data?.roleChanges ?? "-"}</Title>
          </Card>
        </SimpleGrid>

        <Card withBorder mb="md" p="sm">
          <Text fw={600} mb={4}>
            Top actions
          </Text>
          {summaryQuery.isLoading ? (
            <Text size="sm" c="dimmed">
              Loading summary...
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
              No summary data.
            </Text>
          )}
        </Card>

        <Card withBorder mb="md" p="sm">
          <Text fw={600} mb={8}>
            Security alerts
          </Text>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Detected</Table.Th>
                <Table.Th>Severity</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Count</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {alertsQuery.isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>Loading alerts...</Table.Td>
                </Table.Tr>
              ) : alerts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>No alerts for selected window.</Table.Td>
                </Table.Tr>
              ) : (
                alerts.map((alert) => (
                  <Table.Tr key={alert.id}>
                    <Table.Td>{formatDate(alert.detectedAtUtc)}</Table.Td>
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
              <Table.Th>Timestamp</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Resource</Table.Th>
              <Table.Th>Result</Table.Th>
              <Table.Th>IP</Table.Th>
              <Table.Th>Correlation</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {auditQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>Loading events...</Table.Td>
              </Table.Tr>
            ) : events.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>No events.</Table.Td>
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
