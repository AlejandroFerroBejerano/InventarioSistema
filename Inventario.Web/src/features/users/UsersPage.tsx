import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconEdit,
  IconPlus,
  IconPower,
  IconShieldLock,
  IconTrash,
} from "@tabler/icons-react";
import { useI18n } from "../../app/i18n/AppI18nContext";
import {
  createUser,
  deleteUser,
  getUsers,
  setUserStatus,
  updateUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserDto,
} from "../../api/users";
import {
  confirmMfa,
  disableMfa,
  getMfaSetup,
  regenerateRecoveryCodes,
  type MfaSetupResponse,
} from "../../api/auth";

type RoleOption = {
  value: string;
  label: string;
};

const roleOptions: RoleOption[] = [
  { value: "GlobalAdmin", label: "GlobalAdmin" },
  { value: "TechnicalAdmin", label: "TechnicalAdmin" },
  { value: "Operator", label: "Operator" },
  { value: "Auditor", label: "Auditor" },
];

const statusOptions = ["Active", "Disabled", "Deleted"];

function renderUserStatus(status: string, t: (spanish: string, english: string) => string) {
  return (
    <Badge color={status === "Active" ? "green" : status === "Disabled" ? "orange" : "red"} variant="light">
      {status === "Active"
        ? t("Activo", "Active")
        : status === "Disabled"
          ? t("Deshabilitado", "Disabled")
          : status === "Deleted"
            ? t("Eliminado", "Deleted")
            : status}
    </Badge>
  );
}

function renderMfaStatus(user: UserDto, t: (spanish: string, english: string) => string) {
  if (user.isMfaEnabled) {
    return (
      <Badge color="teal" variant="light">
        {t("Habilitado", "Enabled")}
      </Badge>
    );
  }

  if (user.isMfaRequiredByRole) {
    return (
      <Badge color="orange" variant="light">
        {t("Requerido", "Required")}
      </Badge>
    );
  }

  return (
    <Badge color="gray" variant="light">
      {t("Deshabilitado", "Disabled")}
    </Badge>
  );
}

export function UsersPage() {
  const { t, formatDateTime } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["users", statusFilter, roleFilter, includeDeleted],
    queryFn: () =>
      getUsers({
        status: statusFilter || null,
        role: roleFilter || null,
        includeDeleted,
      }),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaUser, setMfaUser] = useState<UserDto | null>(null);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [form, setForm] = useState({
    id: "",
    email: "",
    password: "",
    displayName: "",
    userName: "",
    status: "Active",
    role: "",
    organizationScope: "",
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserRequest) => createUser(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      notifications.show({
        title: t("Usuario creado", "User created"),
        message: t("El usuario quedo registrado.", "The user was registered."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error al crear", "Error creating user"),
        message: error?.message ?? t("No fue posible crear el usuario.", "Could not create the user."),
        color: "red",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; body: UpdateUserRequest }) =>
      updateUser(payload.id, payload.body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      setEditOpen(false);
      notifications.show({
        title: t("Usuario actualizado", "User updated"),
        message: t("Los cambios fueron guardados.", "Changes were saved."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error actualizando", "Error updating user"),
        message: error?.message ?? t("No fue posible actualizar.", "Could not update the user."),
        color: "red",
      });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setUserStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({
        title: t("Estado actualizado", "Status updated"),
        message: t("Se actualizo el estado del usuario.", "The user status was updated."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error de estado", "Status error"),
        message: error?.message ?? t("No se pudo cambiar el estado.", "Could not change the status."),
        color: "red",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({
        title: t("Usuario eliminado logicamente", "User soft-deleted"),
        message: t("No se mostrara en vistas por defecto.", "It will no longer appear in default views."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error al eliminar", "Error deleting user"),
        message: error?.message ?? t("No fue posible eliminar.", "Could not delete the user."),
        color: "red",
      });
    },
  });

  const loadMfaSetupMutation = useMutation({
    mutationFn: (userId: string) => getMfaSetup(userId),
    onSuccess: (data) => {
      setMfaSetupData(data);
    },
    onError: (error: any) => {
      notifications.show({
        title: t("No se pudo cargar MFA", "Could not load MFA"),
        message: error?.message ?? t("Error consultando setup MFA.", "Error loading MFA setup."),
        color: "red",
      });
    },
  });

  const confirmMfaMutation = useMutation({
    mutationFn: ({ userId, code }: { userId: string; code: string }) => confirmMfa(code, userId),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recoveryCodes ?? []);
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({
        title: t("MFA habilitado", "MFA enabled"),
        message: t("Se activaron codigos de recuperacion.", "Recovery codes were enabled."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("No se pudo habilitar MFA", "Could not enable MFA"),
        message: error?.message ?? t("Codigo invalido.", "Invalid code."),
        color: "red",
      });
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: (userId: string) => disableMfa(userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      setRecoveryCodes([]);
      notifications.show({
        title: t("MFA deshabilitado", "MFA disabled"),
        message: t("El usuario ya no requiere segundo factor.", "The user no longer requires a second factor."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("No se pudo deshabilitar MFA", "Could not disable MFA"),
        message: error?.message ?? t("Operacion no permitida.", "Operation not allowed."),
        color: "red",
      });
    },
  });

  const regenerateRecoveryMutation = useMutation({
    mutationFn: (userId: string) => regenerateRecoveryCodes(userId),
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes ?? []);
      notifications.show({
        title: t("Codigos regenerados", "Codes regenerated"),
        message: t("Guarda los nuevos codigos de recuperacion.", "Save the new recovery codes."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("No se pudo regenerar", "Could not regenerate"),
        message: error?.message ?? t("Operacion no permitida.", "Operation not allowed."),
        color: "red",
      });
    },
  });

  function openCreate() {
    setForm({
      id: "",
      email: "",
      password: "",
      displayName: "",
      userName: "",
      status: "Active",
      role: "",
      organizationScope: "",
    });
    setCreateOpen(true);
  }

  function openEdit(user: UserDto) {
    setForm({
      id: user.id,
      email: user.email,
      password: "",
      displayName: user.displayName,
      userName: user.userName,
      status: user.status,
      role: user.roles[0] ?? "",
      organizationScope: user.organizationScope ?? "",
    });
    setEditOpen(true);
  }

  function openMfa(user: UserDto) {
    setMfaUser(user);
    setMfaCode("");
    setRecoveryCodes([]);
    setMfaSetupData(null);
    setMfaOpen(true);
    loadMfaSetupMutation.mutate(user.id);
  }

  async function saveCreate() {
    if (!form.email.trim() || !form.password.trim() || !form.displayName.trim()) {
      notifications.show({
        title: t("Campos incompletos", "Missing fields"),
        message: t(
          "Email, password y nombre visible son obligatorios.",
          "Email, password, and display name are required."
        ),
        color: "red",
      });
      return;
    }

    await createMutation.mutateAsync({
      email: form.email.trim(),
      password: form.password.trim(),
      userName: form.userName.trim() || undefined,
      displayName: form.displayName.trim() || undefined,
      status: form.status,
      role: form.role || undefined,
      organizationScope: form.organizationScope.trim() || undefined,
    });
  }

  async function saveEdit() {
    await updateMutation.mutateAsync({
      id: form.id,
      body: {
        email: form.email.trim() || undefined,
        userName: form.userName.trim() || undefined,
        displayName: form.displayName.trim() || undefined,
        status: form.status || undefined,
        role: form.role || undefined,
        organizationScope: form.organizationScope.trim() || undefined,
      },
    });
  }

  async function confirmSelectedMfa() {
    if (!mfaUser) return;
    const code = mfaCode.trim();
    if (!code) {
      notifications.show({
        title: t("Falta codigo", "Missing code"),
        message: t("Introduce el codigo del autenticador.", "Enter the authenticator code."),
        color: "red",
      });
      return;
    }

    await confirmMfaMutation.mutateAsync({ userId: mfaUser.id, code });
  }

  useEffect(() => {
    if (!usersQuery.isRefetching && usersQuery.isError) {
      notifications.show({
        title: t("Error cargando usuarios", "Error loading users"),
        message: t("No se pudo obtener el listado de usuarios.", "Could not load the user list."),
        color: "red",
      });
    }
  }, [t, usersQuery.isError, usersQuery.isRefetching]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>{t("Gestion de usuarios", "User management")}</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t("Crear usuario", "Create user")}
          </Button>
        </Group>

        <Group wrap="wrap" mb="md">
          <TextInput
            label={t("Estado", "Status")}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value)}
          />
          <Select
            label={t("Rol", "Role")}
            clearable
            value={roleFilter || null}
            data={roleOptions}
            onChange={(value) => setRoleFilter(value ?? "")}
          />
          <Select
            label={t("Incluir eliminados", "Include deleted")}
            value={includeDeleted ? "yes" : "no"}
            data={[
              { value: "no", label: t("No", "No") },
              { value: "yes", label: t("Si", "Yes") },
            ]}
            onChange={(value) => setIncludeDeleted(value === "yes")}
          />
        </Group>

        <Table striped highlightOnHover withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>{t("Nombre", "Name")}</Table.Th>
              <Table.Th>{t("Estado", "Status")}</Table.Th>
              <Table.Th>{t("Roles", "Roles")}</Table.Th>
              <Table.Th>MFA</Table.Th>
              <Table.Th>{t("Ultimo acceso", "Last access")}</Table.Th>
              <Table.Th>{t("Creacion", "Created")}</Table.Th>
              <Table.Th>{t("Acciones", "Actions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usersQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={8}>{t("Cargando...", "Loading...")}</Table.Td>
              </Table.Tr>
            ) : users.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>{t("No hay usuarios.", "There are no users.")}</Table.Td>
              </Table.Tr>
            ) : (
              users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>{user.displayName}</Table.Td>
                  <Table.Td>{renderUserStatus(user.status, t)}</Table.Td>
                  <Table.Td>{(user.roles ?? []).join(", ") || "-"}</Table.Td>
                  <Table.Td>{renderMfaStatus(user, t)}</Table.Td>
                  <Table.Td>{formatDateTime(user.lastLoginUtc)}</Table.Td>
                  <Table.Td>{formatDateTime(user.createdAtUtc)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openEdit(user)}
                        title={t("Editar", "Edit")}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="violet"
                        variant="subtle"
                        onClick={() => openMfa(user)}
                        title={t("Configurar MFA", "Configure MFA")}
                      >
                        <IconShieldLock size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() =>
                          setStatusMutation.mutate({
                            id: user.id,
                            status: user.status === "Active" ? "Disabled" : "Active",
                          })
                        }
                        title={user.status === "Active" ? t("Desactivar", "Disable") : t("Activar", "Activate")}
                      >
                        <IconPower size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => deleteMutation.mutate(user.id)}
                        title={t("Eliminar logicamente", "Soft delete")}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("Crear usuario", "Create user")}
      >
        <Stack>
          <TextInput
            label="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Password", "Password")}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.currentTarget.value }))}
            type="password"
          />
          <TextInput
            label={t("Nombre", "Name")}
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Usuario", "Username")}
            value={form.userName}
            onChange={(event) => setForm((current) => ({ ...current, userName: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Organizacion", "Organization")}
            value={form.organizationScope}
            onChange={(event) => setForm((current) => ({ ...current, organizationScope: event.currentTarget.value }))}
          />
          <Select
            label={t("Estado", "Status")}
            value={form.status}
            data={statusOptions}
            onChange={(value) => setForm((current) => ({ ...current, status: value ?? "Active" }))}
          />
          <Select
            label={t("Rol", "Role")}
            clearable
            value={form.role || null}
            data={roleOptions}
            onChange={(value) => setForm((current) => ({ ...current, role: value ?? "" }))}
          />
          <Button loading={createMutation.isPending} onClick={saveCreate}>
            {t("Guardar", "Save")}
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("Editar usuario", "Edit user")}
      >
        <Stack>
          <TextInput
            label="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Nombre", "Name")}
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Usuario", "Username")}
            value={form.userName}
            onChange={(event) => setForm((current) => ({ ...current, userName: event.currentTarget.value }))}
          />
          <TextInput
            label={t("Organizacion", "Organization")}
            value={form.organizationScope}
            onChange={(event) => setForm((current) => ({ ...current, organizationScope: event.currentTarget.value }))}
          />
          <Select
            label={t("Estado", "Status")}
            value={form.status}
            data={statusOptions}
            onChange={(value) => setForm((current) => ({ ...current, status: value ?? "Active" }))}
          />
          <Select
            label={t("Rol", "Role")}
            clearable
            value={form.role || null}
            data={roleOptions}
            onChange={(value) => setForm((current) => ({ ...current, role: value ?? "" }))}
          />
          <Button loading={updateMutation.isPending} onClick={saveEdit}>
            {t("Guardar cambios", "Save changes")}
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={mfaOpen}
        onClose={() => setMfaOpen(false)}
        title={mfaUser ? `${t("MFA de", "MFA for")} ${mfaUser.email}` : t("Gestion MFA", "MFA management")}
        size="lg"
      >
        <Stack>
          {mfaUser ? (
            <>
              <Group gap="xs">
                <Text fw={600}>{t("Estado:", "Status:")}</Text>
                {renderMfaStatus(mfaUser, t)}
              </Group>

              {loadMfaSetupMutation.isPending ? (
                <Text c="dimmed">{t("Cargando datos MFA...", "Loading MFA data...")}</Text>
              ) : null}

              {mfaSetupData && !mfaUser.isMfaEnabled ? (
                <>
                  <Text size="sm" c="dimmed">
                    {t(
                      "Escanea el URI en tu app de autenticacion o usa la clave manual.",
                      "Scan the URI in your authenticator app or use the manual key."
                    )}
                  </Text>
                  <TextInput
                    label={t("Clave manual", "Manual key")}
                    value={mfaSetupData.manualEntryCode ?? ""}
                    readOnly
                  />
                  <TextInput label="OTP URI" value={mfaSetupData.qrCodeUri ?? ""} readOnly />
                  <TextInput
                    label={t("Codigo actual", "Current code")}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.currentTarget.value)}
                    placeholder="123456"
                  />
                  <Button loading={confirmMfaMutation.isPending} onClick={confirmSelectedMfa}>
                    {t("Confirmar y habilitar MFA", "Confirm and enable MFA")}
                  </Button>
                </>
              ) : null}

              {mfaUser.isMfaEnabled ? (
                <Group>
                  <Button
                    variant="light"
                    loading={regenerateRecoveryMutation.isPending}
                    onClick={() => regenerateRecoveryMutation.mutate(mfaUser.id)}
                  >
                    {t("Regenerar codigos de recuperacion", "Regenerate recovery codes")}
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    loading={disableMfaMutation.isPending}
                    onClick={() => disableMfaMutation.mutate(mfaUser.id)}
                  >
                    {t("Deshabilitar MFA", "Disable MFA")}
                  </Button>
                </Group>
              ) : null}

              {recoveryCodes.length > 0 ? (
                <Card withBorder radius="md" p="sm">
                  <Stack gap="xs">
                    <Text fw={600}>
                      {t(
                        "Codigos de recuperacion (guardalos en lugar seguro)",
                        "Recovery codes (store them in a safe place)"
                      )}
                    </Text>
                    {recoveryCodes.map((code) => (
                      <Text key={code} ff="monospace">
                        {code}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              ) : null}
            </>
          ) : (
            <Text c="dimmed">{t("Selecciona un usuario.", "Select a user.")}</Text>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
