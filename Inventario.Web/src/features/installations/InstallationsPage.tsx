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
import { useSelectedInstallation } from "./useSelectedInstallation";
import { InstallationPicker, type InstallationListItem } from "./components/InstallationPicker";
import { getInstallations, createInstallation } from "../../api/installations";
import {
  addInstallationCredential,
  deleteInstallationCredential,
  getInstallationCredentialSecret,
  getInstallationCredentials,
  updateInstallationCredential,
  type CredentialListItemDto,
} from "../../api/installationCredentials";

export function InstallationsPage() {
  const qc = useQueryClient();

  //const [selectedAbonadoMm, setSelectedAbonadoMm] = useState<string | null>(null);
  const { selectedAbonadoMm, setSelectedAbonadoMm } = useSelectedInstallation();

  // Modal Crear credencial
  const [createOpen, setCreateOpen] = useState(false);
  const [cUsername, setCUsername] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cLabel, setCLabel] = useState("");
  const [cScope, setCScope] = useState("General");
  const [cPriority, setCPriority] = useState<number>(1);
  const [cIsActive, setCIsActive] = useState(true);

  // Modal Editar credencial
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialListItemDto | null>(null);
  const [eLabel, setELabel] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [ePasswordVisible, setEPasswordVisible] = useState(false);
  const [eScope, setEScope] = useState("General");
  const [ePriority, setEPriority] = useState<number>(1);
  const [eIsActive, setEIsActive] = useState(true);

  // Modal Eliminar credencial
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<CredentialListItemDto | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const installationsQuery = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
  });

  const createInstallationMutation = useMutation({
    mutationFn: createInstallation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["installations"] });
      notifications.show({ title: "Instalación creada", message: "Instalación añadida correctamente." });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error creando instalación",
        message: err?.message ?? "Error desconocido",
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
      notifications.show({ title: "Credencial creada", message: "La credencial se ha añadido a la instalación." });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error creando credencial",
        message: err?.message ?? "Error desconocido",
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
      notifications.show({ title: "Credencial actualizada", message: "Cambios guardados." });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error actualizando credencial",
        message: err?.message ?? "Error desconocido",
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
        title: "Error cargando contraseña",
        message: err?.message ?? "Error desconocido",
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
        title: "Credencial eliminada",
        message: "La credencial se ha eliminado correctamente.",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error eliminando credencial",
        message: err?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const rows = useMemo(() => {
    const items = credentialsQuery.data ?? [];
    if (!items.length) return null;

    return items.map((c) => (
      <Table.Tr key={c.credentialId}>
        <Table.Td>{c.username}</Table.Td>
        <Table.Td>{c.label ?? "-"}</Table.Td>
        <Table.Td>{c.scope}</Table.Td>
        <Table.Td>{c.priority}</Table.Td>
        <Table.Td>
          {c.isActive ? (
            <Badge color="green" variant="light">
              Activa
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Inactiva
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-start" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setEditing(c);
                setELabel(c.label ?? "");
                setEPassword("");
                setEPasswordVisible(false);
                setEScope(c.scope ?? "General");
                setEPriority(c.priority ?? 1);
                setEIsActive(!!c.isActive);
                setEditOpen(true);

                if (selectedAbonadoMm) {
                  loadCredentialSecretMutation.mutate({
                    abonadoMm: selectedAbonadoMm,
                    credentialId: c.credentialId,
                  });
                }
              }}
            >
              Editar
            </Button>

            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              aria-label="Eliminar credencial"
              onClick={() => {
                setCredentialToDelete(c);
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
  }, [credentialsQuery.data, loadCredentialSecretMutation, selectedAbonadoMm]);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>Instalaciones y credenciales</Title>
            <Text c="dimmed">Gestiona credenciales por instalación (prioridad, scope, activación).</Text>
          </div>

          <Button
            variant="light"
            onClick={() => setCreateOpen(true)}
            disabled={!selectedAbonadoMm}
          >
            Nueva credencial
          </Button>
        </Group>

        <Stack gap="sm" mt="md">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
            label="Instalación"
          />

          {!selectedAbonadoMm && (
            <Text c="dimmed">Selecciona una instalación para ver y gestionar sus credenciales.</Text>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center">
          <Title order={4}>Credenciales</Title>
          <Text c="dimmed" size="sm">
            {selectedAbonadoMm ? `Instalación: ${selectedAbonadoMm}` : "—"}
          </Text>
        </Group>

        <Table mt="md" striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Username</Table.Th>
              <Table.Th>Label</Table.Th>
              <Table.Th>Scope</Table.Th>
              <Table.Th>Prioridad</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows ?? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed">
                    {credentialsQuery.isFetching
                      ? "Cargando credenciales..."
                      : selectedAbonadoMm
                        ? "No hay credenciales todavía. Crea la primera."
                        : "Selecciona una instalación."}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal crear credencial */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Nueva credencial" centered>
        <Stack>
          <TextInput label="Username" value={cUsername} onChange={(e) => setCUsername(e.currentTarget.value)} />
          <TextInput
            label="Password"
            type="password"
            value={cPassword}
            onChange={(e) => setCPassword(e.currentTarget.value)}
          />
          <TextInput label="Label (opcional)" value={cLabel} onChange={(e) => setCLabel(e.currentTarget.value)} />
          <TextInput label="Scope" value={cScope} onChange={(e) => setCScope(e.currentTarget.value)} />
          <NumberInput
            label="Prioridad (1 = primero)"
            min={1}
            max={999}
            value={cPriority}
            onChange={(v) => setCPriority(Number(v ?? 1))}
          />
          <Switch label="Activa" checked={cIsActive} onChange={(e) => setCIsActive(e.currentTarget.checked)} />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>
              Cancelar
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
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal editar credencial */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Editar credencial" centered>
        <Stack>
          <Text size="sm" c="dimmed">
            {editing ? `Username: ${editing.username} (ID ${editing.credentialId})` : "—"}
          </Text>

          <TextInput label="Label" value={eLabel} onChange={(e) => setELabel(e.currentTarget.value)} />
          <TextInput
            label="Password"
            type={ePasswordVisible ? "text" : "password"}
            value={ePassword}
            onChange={(e) => setEPassword(e.currentTarget.value)}
            description="Puedes sobrescribir la contraseña existente."
            rightSection={
              <ActionIcon
                variant="subtle"
                onClick={() => setEPasswordVisible((v) => !v)}
                aria-label={ePasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {ePasswordVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            }
          />
          {loadCredentialSecretMutation.isPending && (
            <Text size="xs" c="dimmed">
              Cargando contraseña...
            </Text>
          )}
          <TextInput label="Scope" value={eScope} onChange={(e) => setEScope(e.currentTarget.value)} />
          <NumberInput
            label="Prioridad"
            min={1}
            max={999}
            value={ePriority}
            onChange={(v) => setEPriority(Number(v ?? 1))}
          />
          <Switch label="Activa" checked={eIsActive} onChange={(e) => setEIsActive(e.currentTarget.checked)} />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpen(false)}>
              Cancelar
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
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal eliminar credencial */}
      <Modal
        opened={deleteOpen}
        onClose={() => {
          if (!deleteCredentialMutation.isPending) {
            setDeleteOpen(false);
            setCredentialToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title="Eliminar credencial"
        centered
      >
        <Stack>
          <Text>
            Se eliminará esta credencial de la instalación.
            <br />
            Escribe <Text span fw={700}>delete</Text> para confirmar.
          </Text>

          <Card withBorder radius="md" p="sm">
            <Text fw={600}>{credentialToDelete?.username ?? "-"}</Text>
            <Text c="dimmed" size="sm">
              Scope: {credentialToDelete?.scope ?? "-"}
            </Text>
            <Text c="dimmed" size="sm">
              Prioridad: {credentialToDelete?.priority ?? "-"}
            </Text>
          </Card>

          <TextInput
            label="Escribe delete para confirmar"
            placeholder="delete"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.currentTarget.value)}
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
              Cancelar
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
              Eliminar credencial
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
