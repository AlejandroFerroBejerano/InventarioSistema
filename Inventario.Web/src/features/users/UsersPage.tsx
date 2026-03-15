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
import {
  createUser,
  deleteUser,
  getUsers,
  setUserStatus,
  updateUser,
  type CreateUserRequest,
  type UserDto,
  type UpdateUserRequest,
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function UsersPage() {
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
        title: "Usuario creado",
        message: "El usuario quedo registrado.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error al crear",
        message: error?.message ?? "No fue posible crear el usuario.",
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
        title: "Usuario actualizado",
        message: "Los cambios fueron guardados.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error actualizando",
        message: error?.message ?? "No fue posible actualizar.",
        color: "red",
      });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setUserStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({
        title: "Estado actualizado",
        message: "Se actualizo el estado del usuario.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error de estado",
        message: error?.message ?? "No se pudo cambiar el estado.",
        color: "red",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({
        title: "Usuario eliminado logicamente",
        message: "No se mostrara en vistas por defecto.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error al eliminar",
        message: error?.message ?? "No fue posible eliminar.",
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
        title: "No se pudo cargar MFA",
        message: error?.message ?? "Error consultando setup MFA.",
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
        title: "MFA habilitado",
        message: "Se activaron codigos de recuperacion.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "No se pudo habilitar MFA",
        message: error?.message ?? "Codigo invalido.",
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
        title: "MFA deshabilitado",
        message: "El usuario ya no requiere segundo factor.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "No se pudo deshabilitar MFA",
        message: error?.message ?? "Operacion no permitida.",
        color: "red",
      });
    },
  });

  const regenerateRecoveryMutation = useMutation({
    mutationFn: (userId: string) => regenerateRecoveryCodes(userId),
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes ?? []);
      notifications.show({
        title: "Codigos regenerados",
        message: "Guarda los nuevos codigos de recuperacion.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "No se pudo regenerar",
        message: error?.message ?? "Operacion no permitida.",
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
        title: "Campos incompletos",
        message: "Email, password y nombre visible son obligatorios.",
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
        title: "Falta codigo",
        message: "Introduce el codigo del autenticador.",
        color: "red",
      });
      return;
    }

    await confirmMfaMutation.mutateAsync({ userId: mfaUser.id, code });
  }

  useEffect(() => {
    if (!usersQuery.isRefetching && usersQuery.isError) {
      notifications.show({
        title: "Error cargando usuarios",
        message: "No se pudo obtener el listado de usuarios.",
        color: "red",
      });
    }
  }, [usersQuery.isError, usersQuery.isRefetching]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>Gestion de usuarios (Fase 2)</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Crear usuario
          </Button>
        </Group>

        <Group wrap="wrap" mb="md">
          <TextInput label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.currentTarget.value)} />
          <Select
            label="Rol"
            clearable
            value={roleFilter || null}
            data={roleOptions}
            onChange={(value) => setRoleFilter(value ?? "")}
          />
          <Select
            label="Incluir eliminados"
            value={includeDeleted ? "Si" : "No"}
            data={[
              { value: "No", label: "No" },
              { value: "Si", label: "Si" },
            ]}
            onChange={(value) => setIncludeDeleted(value === "Si")}
          />
        </Group>

        <Table striped highlightOnHover withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Roles</Table.Th>
              <Table.Th>MFA</Table.Th>
              <Table.Th>Ultimo acceso</Table.Th>
              <Table.Th>Creacion</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usersQuery.isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={8}>Cargando...</Table.Td>
              </Table.Tr>
            ) : users.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>No hay usuarios.</Table.Td>
              </Table.Tr>
            ) : (
              users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>{user.displayName}</Table.Td>
                  <Table.Td>
                    <Badge color={user.status === "Active" ? "green" : "red"} variant="light">
                      {user.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{(user.roles ?? []).join(", ") || "-"}</Table.Td>
                  <Table.Td>
                    {user.isMfaEnabled ? (
                      <Badge color="teal" variant="light">
                        Enabled
                      </Badge>
                    ) : user.isMfaRequiredByRole ? (
                      <Badge color="orange" variant="light">
                        Required
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Disabled
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{formatDate(user.lastLoginUtc)}</Table.Td>
                  <Table.Td>{formatDate(user.createdAtUtc)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" onClick={() => openEdit(user)} title="Editar">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="violet"
                        variant="subtle"
                        onClick={() => openMfa(user)}
                        title="Configurar MFA"
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
                        title={user.status === "Active" ? "Desactivar" : "Activar"}
                      >
                        <IconPower size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => deleteMutation.mutate(user.id)}
                        title="Eliminar logico"
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

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Crear usuario">
        <Stack>
          <TextInput
            label="Email"
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.currentTarget.value }))}
          />
          <TextInput
            label="Password"
            value={form.password}
            onChange={(event) => setForm((f) => ({ ...f, password: event.currentTarget.value }))}
            type="password"
          />
          <TextInput
            label="Nombre"
            value={form.displayName}
            onChange={(event) => setForm((f) => ({ ...f, displayName: event.currentTarget.value }))}
          />
          <TextInput
            label="Usuario"
            value={form.userName}
            onChange={(event) => setForm((f) => ({ ...f, userName: event.currentTarget.value }))}
          />
          <TextInput
            label="Organizacion"
            value={form.organizationScope}
            onChange={(event) => setForm((f) => ({ ...f, organizationScope: event.currentTarget.value }))}
          />
          <Select
            label="Estado"
            value={form.status}
            data={statusOptions}
            onChange={(value) => setForm((f) => ({ ...f, status: value ?? "Active" }))}
          />
          <Select
            label="Rol"
            clearable
            value={form.role || null}
            data={roleOptions}
            onChange={(value) => setForm((f) => ({ ...f, role: value ?? "" }))}
          />
          <Button loading={createMutation.isPending} onClick={saveCreate}>
            Guardar
          </Button>
        </Stack>
      </Modal>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Editar usuario">
        <Stack>
          <TextInput
            label="Email"
            value={form.email}
            onChange={(event) => setForm((f) => ({ ...f, email: event.currentTarget.value }))}
          />
          <TextInput
            label="Nombre"
            value={form.displayName}
            onChange={(event) => setForm((f) => ({ ...f, displayName: event.currentTarget.value }))}
          />
          <TextInput
            label="Usuario"
            value={form.userName}
            onChange={(event) => setForm((f) => ({ ...f, userName: event.currentTarget.value }))}
          />
          <TextInput
            label="Organizacion"
            value={form.organizationScope}
            onChange={(event) => setForm((f) => ({ ...f, organizationScope: event.currentTarget.value }))}
          />
          <Select
            label="Estado"
            value={form.status}
            data={statusOptions}
            onChange={(value) => setForm((f) => ({ ...f, status: value ?? "Active" }))}
          />
          <Select
            label="Rol"
            clearable
            value={form.role || null}
            data={roleOptions}
            onChange={(value) => setForm((f) => ({ ...f, role: value ?? "" }))}
          />
          <Button loading={updateMutation.isPending} onClick={saveEdit}>
            Guardar cambios
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={mfaOpen}
        onClose={() => setMfaOpen(false)}
        title={mfaUser ? `MFA de ${mfaUser.email}` : "Gestion MFA"}
        size="lg"
      >
        <Stack>
          {mfaUser ? (
            <>
              <Group gap="xs">
                <Text fw={600}>Estado:</Text>
                {mfaUser.isMfaEnabled ? (
                  <Badge color="teal" variant="light">
                    Enabled
                  </Badge>
                ) : (
                  <Badge color={mfaUser.isMfaRequiredByRole ? "orange" : "gray"} variant="light">
                    {mfaUser.isMfaRequiredByRole ? "Required by role" : "Disabled"}
                  </Badge>
                )}
              </Group>

              {loadMfaSetupMutation.isPending ? (
                <Text c="dimmed">Cargando datos MFA...</Text>
              ) : null}

              {mfaSetupData && !mfaUser.isMfaEnabled ? (
                <>
                  <Text size="sm" c="dimmed">
                    Escanea el URI en tu app de autenticacion o usa la clave manual.
                  </Text>
                  <TextInput
                    label="Clave manual"
                    value={mfaSetupData.manualEntryCode ?? ""}
                    readOnly
                  />
                  <TextInput
                    label="URI OTP"
                    value={mfaSetupData.qrCodeUri ?? ""}
                    readOnly
                  />
                  <TextInput
                    label="Codigo actual"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.currentTarget.value)}
                    placeholder="123456"
                  />
                  <Button loading={confirmMfaMutation.isPending} onClick={confirmSelectedMfa}>
                    Confirmar y habilitar MFA
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
                    Regenerar recovery codes
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    loading={disableMfaMutation.isPending}
                    onClick={() => disableMfaMutation.mutate(mfaUser.id)}
                  >
                    Deshabilitar MFA
                  </Button>
                </Group>
              ) : null}

              {recoveryCodes.length > 0 ? (
                <Card withBorder radius="md" p="sm">
                  <Stack gap="xs">
                    <Text fw={600}>Recovery codes (guardalos en lugar seguro)</Text>
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
            <Text c="dimmed">Selecciona un usuario.</Text>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
