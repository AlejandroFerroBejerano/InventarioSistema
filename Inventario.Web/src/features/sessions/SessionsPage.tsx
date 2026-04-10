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
import { useI18n } from "../../app/i18n/AppI18nContext";
import { getSessions, revokeSession, type UserSessionDto } from "../../api/sessions";

export function SessionsPage() {
  const { t, formatDateTime } = useI18n();
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
        title: t("Sesion revocada", "Session revoked"),
        message: t("La sesion se cerro correctamente.", "The session was closed successfully."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("No se pudo revocar", "Could not revoke session"),
        message: error?.message ?? t("No fue posible revocar la sesion.", "Could not revoke the session."),
        color: "red",
      });
    },
  });

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>{t("Sesiones activas", "Active sessions")}</Title>
          <Button
            variant="light"
            onClick={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
            loading={sessionsQuery.isLoading}
          >
            {t("Refrescar", "Refresh")}
          </Button>
        </Group>

        <Table striped highlightOnHover withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>SessionId</Table.Th>
              <Table.Th>{t("Creada", "Created")}</Table.Th>
              <Table.Th>{t("Actividad", "Activity")}</Table.Th>
              <Table.Th>{t("Expira", "Expires")}</Table.Th>
              <Table.Th>{t("Estado", "Status")}</Table.Th>
              <Table.Th>{t("Cliente", "Client")}</Table.Th>
              <Table.Th>{t("Accion", "Action")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessionsQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>{t("Cargando sesiones...", "Loading sessions...")}</Table.Td>
              </Table.Tr>
            ) : sessions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>{t("No hay sesiones.", "There are no sessions.")}</Table.Td>
              </Table.Tr>
            ) : (
              sessions.map((session) => (
                <Table.Tr key={session.id}>
                  <Table.Td>{session.sessionId}</Table.Td>
                  <Table.Td>{formatDateTime(session.createdAtUtc)}</Table.Td>
                  <Table.Td>{formatDateTime(session.lastActiveAtUtc)}</Table.Td>
                  <Table.Td>{formatDateTime(session.expiresAtUtc)}</Table.Td>
                  <Table.Td>{session.isRevoked ? t("Revocada", "Revoked") : t("Activa", "Active")}</Table.Td>
                  <Table.Td>{session.clientIp ?? "-"}</Table.Td>
                  <Table.Td>
                    {!session.isRevoked ? (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => revokeMutation.mutate(session.sessionId)}
                        title={t("Revocar sesion", "Revoke session")}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {session.revokedAtUtc ? formatDateTime(session.revokedAtUtc) : "-"}
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
