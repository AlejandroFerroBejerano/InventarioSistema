import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconEye, IconEyeOff, IconTrash } from "@tabler/icons-react";
import { useI18n } from "../../app/i18n/AppI18nContext";
import { getInstallations, createInstallation } from "../../api/installations";
import {
  addInstallationCredential,
  deleteInstallationCredential,
  getInstallationCredentialSecret,
  getInstallationCredentials,
  updateInstallationCredential,
  type CredentialListItemDto,
} from "../../api/installationCredentials";
import { InstallationPicker } from "./components/InstallationPicker";
import { useSelectedInstallation } from "./useSelectedInstallation";

export function InstallationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { selectedAbonadoMm, setSelectedAbonadoMm } = useSelectedInstallation();

  const [createOpen, setCreateOpen] = useState(false);
  const [cUsername, setCUsername] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cLabel, setCLabel] = useState("");
  const [cScope, setCScope] = useState("General");
  const [cPriority, setCPriority] = useState<number>(1);
  const [cIsActive, setCIsActive] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialListItemDto | null>(null);
  const [eLabel, setELabel] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [ePasswordVisible, setEPasswordVisible] = useState(false);
  const [eScope, setEScope] = useState("General");
  const [ePriority, setEPriority] = useState<number>(1);
  const [eIsActive, setEIsActive] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<CredentialListItemDto | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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
        message: t(
          "La instalacion se ha anadido correctamente.",
          "The installation was added successfully."
        ),
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: t("Error creando instalacion", "Error creating installation"),
        message: err?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const credentialsQuery = useQuery({
    queryKey: ["installationCredentials", selectedAbonadoMm],
    queryFn: () => getInstallationCredentials(selectedAbonadoMm!),
    enabled: !!selectedAbonadoMm,
  });

  const addCredentialMutation = useMutation({
    mutationFn: (payload: {
      abonadoMm: string;
      username: string;
      password: string;
      priority: number;
      scope: string;
      label?: string | null;
      isActive: boolean;
    }) =>
      addInstallationCredential(payload.abonadoMm, {
        username: payload.username,
        password: payload.password,
        priority: payload.priority,
        scope: payload.scope,
        label: payload.label,
        isActive: payload.isActive,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCUsername("");
      setCPassword("");
      setCLabel("");
      setCScope("General");
      setCPriority(1);
      setCIsActive(true);

      await qc.invalidateQueries({ queryKey: ["installationCredentials", selectedAbonadoMm] });
      notifications.show({
        title: t("Credencial creada", "Credential created"),
        message: t(
          "La credencial se ha anadido a la instalacion.",
          "The credential was added to the installation."
        ),
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: t("Error creando credencial", "Error creating credential"),
        message: err?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const updateCredentialMutation = useMutation({
    mutationFn: (payload: { abonadoMm: string; credentialId: number; body: any }) =>
      updateInstallationCredential(payload.abonadoMm, payload.credentialId, payload.body),
    onSuccess: async () => {
      setEditOpen(false);
      setEditing(null);

      await qc.invalidateQueries({ queryKey: ["installationCredentials", selectedAbonadoMm] });
      notifications.show({
        title: t("Credencial actualizada", "Credential updated"),
        message: t("Cambios guardados.", "Changes saved."),
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: t("Error actualizando credencial", "Error updating credential"),
        message: err?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const loadCredentialSecretMutation = useMutation({
    mutationFn: (payload: { abonadoMm: string; credentialId: number }) =>
      getInstallationCredentialSecret(payload.abonadoMm, payload.credentialId),
    onSuccess: (data) => {
      setEPassword(data.password ?? "");
    },
    onError: (err: any) => {
      notifications.show({
        title: t("Error cargando contrasena", "Error loading password"),
        message: err?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: (payload: { abonadoMm: string; credentialId: number; confirmation: string }) =>
      deleteInstallationCredential(payload.abonadoMm, payload.credentialId, payload.confirmation),
    onSuccess: async () => {
      setDeleteOpen(false);
      setCredentialToDelete(null);
      setDeleteConfirmation("");

      await qc.invalidateQueries({ queryKey: ["installationCredentials", selectedAbonadoMm] });
      notifications.show({
        title: t("Credencial eliminada", "Credential deleted"),
        message: t(
          "La credencial se ha eliminado correctamente.",
          "The credential was deleted successfully."
        ),
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: t("Error eliminando credencial", "Error deleting credential"),
        message: err?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const rows = useMemo(() => {
    const items = credentialsQuery.data ?? [];
    if (!items.length) return null;

    return items.map((credential) => (
      <Table.Tr key={credential.credentialId}>
        <Table.Td>{credential.username}</Table.Td>
        <Table.Td>{credential.label ?? "-"}</Table.Td>
        <Table.Td>{credential.scope}</Table.Td>
        <Table.Td>{credential.priority}</Table.Td>
        <Table.Td>
          {credential.isActive ? (
            <Badge color="green" variant="light">
              {t("Activa", "Active")}
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              {t("Inactiva", "Inactive")}
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-start" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setEditing(credential);
                setELabel(credential.label ?? "");
                setEPassword("");
                setEPasswordVisible(false);
                setEScope(credential.scope ?? "General");
                setEPriority(credential.priority ?? 1);
                setEIsActive(!!credential.isActive);
                setEditOpen(true);

                if (selectedAbonadoMm) {
                  loadCredentialSecretMutation.mutate({
                    abonadoMm: selectedAbonadoMm,
                    credentialId: credential.credentialId,
                  });
                }
              }}
            >
              {t("Editar", "Edit")}
            </Button>

            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              aria-label={t("Eliminar credencial", "Delete credential")}
              onClick={() => {
                setCredentialToDelete(credential);
                setDeleteConfirmation("");
                setDeleteOpen(true);
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    ));
  }, [credentialsQuery.data, loadCredentialSecretMutation, selectedAbonadoMm, t]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>
              {t("Instalaciones y credenciales", "Installations and credentials")}
            </Title>
            <Text c="dimmed">
              {t(
                "Gestiona credenciales por instalacion: prioridad, alcance y activacion.",
                "Manage credentials per installation: priority, scope, and activation."
              )}
            </Text>
          </div>

          <Button variant="light" onClick={() => setCreateOpen(true)} disabled={!selectedAbonadoMm}>
            {t("Nueva credencial", "New credential")}
          </Button>
        </Group>

        <Stack gap="sm" mt="md">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
            label={t("Instalacion", "Installation")}
          />

          {!selectedAbonadoMm ? (
            <Text c="dimmed">
              {t(
                "Selecciona una instalacion para ver y gestionar sus credenciales.",
                "Select an installation to view and manage its credentials."
              )}
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center">
          <Title order={4}>{t("Credenciales", "Credentials")}</Title>
          <Text c="dimmed" size="sm">
            {selectedAbonadoMm
              ? `${t("Instalacion", "Installation")}: ${selectedAbonadoMm}`
              : "-"}
          </Text>
        </Group>

        <Table mt="md" striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Usuario", "Username")}</Table.Th>
              <Table.Th>{t("Etiqueta", "Label")}</Table.Th>
              <Table.Th>{t("Alcance", "Scope")}</Table.Th>
              <Table.Th>{t("Prioridad", "Priority")}</Table.Th>
              <Table.Th>{t("Estado", "Status")}</Table.Th>
              <Table.Th>{t("Acciones", "Actions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows ?? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed">
                    {credentialsQuery.isFetching
                      ? t("Cargando credenciales...", "Loading credentials...")
                      : selectedAbonadoMm
                        ? t(
                            "No hay credenciales todavia. Crea la primera.",
                            "There are no credentials yet. Create the first one."
                          )
                        : t("Selecciona una instalacion.", "Select an installation.")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("Nueva credencial", "New credential")}
        centered
      >
        <Stack>
          <TextInput
            label={t("Usuario", "Username")}
            value={cUsername}
            onChange={(event) => setCUsername(event.currentTarget.value)}
          />
          <TextInput
            label={t("Contrasena", "Password")}
            type="password"
            value={cPassword}
            onChange={(event) => setCPassword(event.currentTarget.value)}
          />
          <TextInput
            label={t("Etiqueta (opcional)", "Label (optional)")}
            value={cLabel}
            onChange={(event) => setCLabel(event.currentTarget.value)}
          />
          <TextInput
            label={t("Alcance", "Scope")}
            value={cScope}
            onChange={(event) => setCScope(event.currentTarget.value)}
          />
          <NumberInput
            label={t("Prioridad (1 = primero)", "Priority (1 = first)")}
            min={1}
            max={999}
            value={cPriority}
            onChange={(value) => setCPriority(Number(value ?? 1))}
          />
          <Switch
            label={t("Activa", "Active")}
            checked={cIsActive}
            onChange={(event) => setCIsActive(event.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>
              {t("Cancelar", "Cancel")}
            </Button>
            <Button
              loading={addCredentialMutation.isPending}
              disabled={!selectedAbonadoMm || !cUsername.trim() || !cPassword.trim()}
              onClick={() => {
                addCredentialMutation.mutate({
                  abonadoMm: selectedAbonadoMm!,
                  username: cUsername.trim(),
                  password: cPassword,
                  label: cLabel.trim() ? cLabel.trim() : null,
                  scope: cScope.trim() ? cScope.trim() : "General",
                  priority: cPriority || 1,
                  isActive: cIsActive,
                });
              }}
            >
              {t("Crear", "Create")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("Editar credencial", "Edit credential")}
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            {editing
              ? `${t("Usuario", "Username")}: ${editing.username} (ID ${editing.credentialId})`
              : "-"}
          </Text>

          <TextInput
            label={t("Etiqueta", "Label")}
            value={eLabel}
            onChange={(event) => setELabel(event.currentTarget.value)}
          />
          <TextInput
            label={t("Contrasena", "Password")}
            type={ePasswordVisible ? "text" : "password"}
            value={ePassword}
            onChange={(event) => setEPassword(event.currentTarget.value)}
            description={t(
              "Puedes sobrescribir la contrasena existente.",
              "You can overwrite the existing password."
            )}
            rightSection={
              <ActionIcon
                variant="subtle"
                onClick={() => setEPasswordVisible((value) => !value)}
                aria-label={
                  ePasswordVisible
                    ? t("Ocultar contrasena", "Hide password")
                    : t("Mostrar contrasena", "Show password")
                }
              >
                {ePasswordVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            }
          />
          {loadCredentialSecretMutation.isPending ? (
            <Text size="xs" c="dimmed">
              {t("Cargando contrasena...", "Loading password...")}
            </Text>
          ) : null}
          <TextInput
            label={t("Alcance", "Scope")}
            value={eScope}
            onChange={(event) => setEScope(event.currentTarget.value)}
          />
          <NumberInput
            label={t("Prioridad", "Priority")}
            min={1}
            max={999}
            value={ePriority}
            onChange={(value) => setEPriority(Number(value ?? 1))}
          />
          <Switch
            label={t("Activa", "Active")}
            checked={eIsActive}
            onChange={(event) => setEIsActive(event.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpen(false)}>
              {t("Cancelar", "Cancel")}
            </Button>
            <Button
              loading={updateCredentialMutation.isPending}
              disabled={!selectedAbonadoMm || !editing}
              onClick={() => {
                if (!selectedAbonadoMm || !editing) return;

                updateCredentialMutation.mutate({
                  abonadoMm: selectedAbonadoMm,
                  credentialId: editing.credentialId,
                  body: {
                    label: eLabel.trim() ? eLabel.trim() : null,
                    password: ePassword.trim() ? ePassword : null,
                    scope: eScope.trim() ? eScope.trim() : "General",
                    priority: ePriority || 1,
                    isActive: eIsActive,
                  },
                });
              }}
            >
              {t("Guardar", "Save")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteOpen}
        onClose={() => {
          if (!deleteCredentialMutation.isPending) {
            setDeleteOpen(false);
            setCredentialToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title={t("Eliminar credencial", "Delete credential")}
        centered
      >
        <Stack>
          <Text>
            {t(
              "Se eliminara esta credencial de la instalacion.",
              "This credential will be removed from the installation."
            )}
            <br />
            {t("Escribe ", "Type ")}
            <Text span fw={700}>
              delete
            </Text>
            {t(" para confirmar.", " to confirm.")}
          </Text>

          <Card withBorder radius="md" p="sm">
            <Text fw={600}>{credentialToDelete?.username ?? "-"}</Text>
            <Text c="dimmed" size="sm">
              {t("Alcance", "Scope")}: {credentialToDelete?.scope ?? "-"}
            </Text>
            <Text c="dimmed" size="sm">
              {t("Prioridad", "Priority")}: {credentialToDelete?.priority ?? "-"}
            </Text>
          </Card>

          <TextInput
            label={t("Escribe delete para confirmar", "Type delete to confirm")}
            placeholder="delete"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.currentTarget.value)}
            disabled={deleteCredentialMutation.isPending}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setDeleteOpen(false);
                setCredentialToDelete(null);
                setDeleteConfirmation("");
              }}
              disabled={deleteCredentialMutation.isPending}
            >
              {t("Cancelar", "Cancel")}
            </Button>
            <Button
              color="red"
              loading={deleteCredentialMutation.isPending}
              disabled={
                !selectedAbonadoMm ||
                !credentialToDelete ||
                deleteConfirmation.trim().toLowerCase() !== "delete"
              }
              onClick={() => {
                if (!selectedAbonadoMm || !credentialToDelete) return;
                deleteCredentialMutation.mutate({
                  abonadoMm: selectedAbonadoMm,
                  credentialId: credentialToDelete.credentialId,
                  confirmation: "delete",
                });
              }}
            >
              {t("Eliminar credencial", "Delete credential")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
