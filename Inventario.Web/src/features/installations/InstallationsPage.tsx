import { useMemo, useState } from "react";
import {
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
import { useSelectedInstallation } from "./useSelectedInstallation";
import { InstallationPicker, type InstallationListItem } from "./components/InstallationPicker";
import { getInstallations, createInstallation } from "../../api/installations";
import {
  addInstallationCredential,
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
  const [eScope, setEScope] = useState("General");
  const [ePriority, setEPriority] = useState<number>(1);
  const [eIsActive, setEIsActive] = useState(true);

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
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setEditing(c);
              setELabel(c.label ?? "");
              setEScope(c.scope ?? "General");
              setEPriority(c.priority ?? 1);
              setEIsActive(!!c.isActive);
              setEditOpen(true);
            }}
          >
            Editar
          </Button>
        </Table.Td>
      </Table.Tr>
    ));
  }, [credentialsQuery.data]);

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
    </Stack>
  );
}
