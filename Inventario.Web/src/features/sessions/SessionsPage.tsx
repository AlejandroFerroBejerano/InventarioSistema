import { useMemo } from "react";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconTrash } from "@tabler/icons-react";
import { getSessions, revokeSession, type UserSessionDto } from "../../api/sessions";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function SessionsPage() {
  const qc = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions(),
  });

  const sessions = useMemo<UserSessionDto[]>(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sessions"] });
      notifications.show({
        title: "Sesion revocada",
        message: "La sesion se cerro correctamente.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "No se pudo revocar",
        message: error?.message ?? "No fue posible revocar la session.",
        color: "red",
      });
    },
  });

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>Sesiones activas</Title>
          <Button
            variant="light"
            onClick={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
            loading={sessionsQuery.isLoading}
          >
            Refrescar
          </Button>
        </Group>

        <Table striped highlightOnHover withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>SessionId</Table.Th>
              <Table.Th>Creada</Table.Th>
              <Table.Th>Actividad</Table.Th>
              <Table.Th>Expira</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Accion</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessionsQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>Cargando sesiones...</Table.Td>
              </Table.Tr>
            ) : sessions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>No hay sesiones.</Table.Td>
              </Table.Tr>
            ) : (
              sessions.map((session) => (
                <Table.Tr key={session.id}>
                  <Table.Td>{session.sessionId}</Table.Td>
                  <Table.Td>{formatDate(session.createdAtUtc)}</Table.Td>
                  <Table.Td>{formatDate(session.lastActiveAtUtc)}</Table.Td>
                  <Table.Td>{formatDate(session.expiresAtUtc)}</Table.Td>
                  <Table.Td>{session.isRevoked ? "Revocada" : "Activa"}</Table.Td>
                  <Table.Td>{session.clientIp ?? "-"}</Table.Td>
                  <Table.Td>
                    {!session.isRevoked ? (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => revokeMutation.mutate(session.sessionId)}
                        title="Revocar session"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {session.revokedAtUtc ? formatDate(session.revokedAtUtc) : "-"}
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
