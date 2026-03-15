import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconPlayerPause,
  IconTrash,
} from "@tabler/icons-react";
import { useSelectedInstallation } from "../installations/useSelectedInstallation";
import { InstallationPicker } from "../installations/components/InstallationPicker";
import { createInstallation, getInstallations } from "../../api/installations";
import { getNetworks, type NetworkDto } from "../../api/networks";
import {
  type AgentDto,
  type AgentJobDto,
  type CreateAgentResponse,
  cancelAgentJob,
  createAgent,
  createAgentJob,
  downloadAgentInstaller,
  getAgentJobs,
  getAgents,
  revokeAgent,
  type CreateAgentScanJobRequest,
} from "../../api/agents";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function agentStatusBadge(agent: AgentDto) {
  if (agent.isRevoked) {
    return (
      <Badge color="red" variant="light">
        Revoked
      </Badge>
    );
  }

  if (agent.isOnline) {
    return (
      <Badge color="green" variant="light">
        Online
      </Badge>
    );
  }

  return (
    <Badge color="gray" variant="light">
      Offline
    </Badge>
  );
}

function jobStatusBadge(status: string) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "completed") {
    return (
      <Badge color="green" variant="light">
        Completed
      </Badge>
    );
  }

  if (normalized === "failed" || normalized === "cancelled") {
    return (
      <Badge color="red" variant="light">
        {status}
      </Badge>
    );
  }

  if (normalized === "running" || normalized === "dispatched") {
    return (
      <Badge color="blue" variant="light">
        {status}
      </Badge>
    );
  }

  return (
    <Badge color="yellow" variant="light">
      {status}
    </Badge>
  );
}

function parsePorts(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0 && value <= 65535)
    )
  );
}

function parseCsvStrings(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AgentsPage() {
  const qc = useQueryClient();
  const { selectedAbonadoMm, setSelectedAbonadoMm } = useSelectedInstallation();

  const installationsQuery = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
  });

  const createInstallationMutation = useMutation({
    mutationFn: createInstallation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["installations"] });
      notifications.show({
        title: "Instalacion creada",
        message: "Ya puedes seleccionarla.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error creando instalacion",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const installationId = useMemo(() => {
    return installationsQuery.data?.find((i) => i.abonadoMm === selectedAbonadoMm)?.id ?? null;
  }, [installationsQuery.data, selectedAbonadoMm]);

  const agentsQuery = useQuery({
    queryKey: ["agents", installationId],
    queryFn: () => getAgents(installationId),
    enabled: installationId != null,
  });

  const networksQuery = useQuery({
    queryKey: ["networks", selectedAbonadoMm],
    queryFn: () => getNetworks((selectedAbonadoMm ?? "").trim()),
    enabled: Boolean((selectedAbonadoMm ?? "").trim()) && installationId != null,
  });

  const jobsQuery = useQuery({
    queryKey: ["agentJobs", installationId],
    queryFn: () => getAgentJobs({ installationId }),
    enabled: installationId != null,
  });

  const [agentName, setAgentName] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [createdAgent, setCreatedAgent] = useState<CreateAgentResponse | null>(null);
  const [installerDownloadingPlatform, setInstallerDownloadingPlatform] = useState<"windows" | "linux" | null>(null);

  const createAgentMutation = useMutation({
    mutationFn: () => {
      if (!installationId) {
        throw new Error("Selecciona primero una instalacion.");
      }

      return createAgent({
        installationId,
        friendlyName: agentName.trim() || null,
        agentCode: agentCode.trim() || null,
      });
    },
    onSuccess: async (response) => {
      setCreatedAgent(response);
      setAgentName("");
      setAgentCode("");
      await qc.invalidateQueries({ queryKey: ["agents", installationId] });
      notifications.show({
        title: "Agente creado",
        message: "Guarda los tokens, solo se muestran una vez.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error creando agente",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const revokeAgentMutation = useMutation({
    mutationFn: revokeAgent,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agents", installationId] });
      notifications.show({
        title: "Agente revocado",
        message: "El agente queda deshabilitado para nuevos trabajos.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error revocando agente",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const [jobNetworkIdText, setJobNetworkIdText] = useState("");
  const jobNetworkId = useMemo(() => {
    const n = Number(jobNetworkIdText);
    return Number.isNaN(n) ? null : n;
  }, [jobNetworkIdText]);

  useEffect(() => {
    const networks = networksQuery.data ?? [];
    const firstId = networks[0]?.id?.toString();
    if (networks.length === 0) {
      setJobNetworkIdText("");
      return;
    }

    if (!jobNetworkIdText) {
      setJobNetworkIdText(firstId ?? "");
      return;
    }

    const exists = networks.some((n) => n.id.toString() === jobNetworkIdText);
    if (!exists) {
      setJobNetworkIdText(firstId ?? "");
    }
  }, [networksQuery.data, jobNetworkIdText]);

  const [jobPriority, setJobPriority] = useState(50);
  const [jobPorts, setJobPorts] = useState("80,443,554,1935,8000,9000");
  const [jobProtocols, setJobProtocols] = useState("http,https");
  const [jobTimeoutMs, setJobTimeoutMs] = useState(4200);
  const [jobConcurrency, setJobConcurrency] = useState(200);
  const [jobUseSsdp, setJobUseSsdp] = useState(true);
  const [jobSsdpMs, setJobSsdpMs] = useState(4200);
  const [jobScope, setJobScope] = useState("Local");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobApplyMode, setJobApplyMode] = useState<"" | "NoDegrade" | "LastWins" | "Review">("");

  const createJobMutation = useMutation({
    mutationFn: () => {
      if (!installationId) {
        throw new Error("Selecciona primero una instalacion.");
      }

      if (!jobNetworkId) {
        throw new Error("Selecciona una red.");
      }

      const network = networksQuery.data?.find((n) => n.id === jobNetworkId);
      if (!network) {
        throw new Error("Red invalida.");
      }

      const payload: CreateAgentScanJobRequest = {
        jobType: "NetworkScan",
        installationId,
        networkId: jobNetworkId,
        networkCidr: network.cidr,
        ports: parsePorts(jobPorts),
        protocols: parseCsvStrings(jobProtocols),
        connectTimeoutMs: jobTimeoutMs,
        maxConcurrency: jobConcurrency,
        useSsdp: jobUseSsdp,
        ssdpListenMs: jobSsdpMs,
        scope: jobScope.trim() || null,
        applyMode: jobApplyMode || null,
        priority: jobPriority,
      };

      return createAgentJob(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agentJobs", installationId] });
      notifications.show({
        title: "Trabajo enviado",
        message: "El trabajo fue creado y enviado a un agente disponible.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error creando trabajo",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: cancelAgentJob,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agentJobs", installationId] });
      notifications.show({
        title: "Trabajo cancelado",
        message: "El estado quedó en cancelado.",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error cancelando trabajo",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    },
  });

  const networkOptions = useMemo(() => {
    return (networksQuery.data ?? []).map((network: NetworkDto) => ({
      value: network.id.toString(),
      label: `${network.name} (${network.cidr})`,
    }));
  }, [networksQuery.data]);

  const filteredJobs = useMemo(() => {
    const data = jobsQuery.data ?? [];
    if (jobStatusFilter === "all") return data;
    return data.filter((job) => (job.status ?? "").toLowerCase() === jobStatusFilter.toLowerCase());
  }, [jobsQuery.data, jobStatusFilter]);

  const terminalJobStatuses = useMemo(() => new Set(["Completed", "Failed", "Cancelled"]), []);

  const enrollmentSnippet = useMemo(() => {
    if (!createdAgent) return "";
    const base = createdAgent.hubUrl.replace(/\/hubs\/agents\/?$/i, "");
    const body = JSON.stringify({
      agentCode: createdAgent.agentCode,
      enrollmentToken: createdAgent.enrollmentToken,
    });
    return `POST ${base}/api/agents/enroll\nBody: ${body}`;
  }, [createdAgent]);

  const installerBaseUrl = useMemo(() => {
    if (!createdAgent) return "";
    return `${createdAgent.hubUrl.replace(/\/hubs\/agents\/?$/i, "")}/api/agents/${createdAgent.agentId}/installer`;
  }, [createdAgent]);

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    notifications.show({
      title: "Copiado",
      message: "Texto copiado al portapapeles.",
    });
  }

  async function downloadInstaller(platform: "windows" | "linux") {
    if (!createdAgent) return;

    setInstallerDownloadingPlatform(platform);
    try {
      const response = await downloadAgentInstaller(
        createdAgent.agentId,
        createdAgent.enrollmentToken,
        platform,
      );

      const contentDisposition = response.headers["content-disposition"];
      const filenameMatch =
        typeof contentDisposition === "string"
          ? /filename="?([^;"\r\n]+)"?/i.exec(contentDisposition)
          : null;

      const filename = filenameMatch?.[1] ?? `agent-installer-${createdAgent.agentCode}-${platform}.zip`;
      const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : "application/zip";
      const blob = new Blob([response.data], { type: contentType });
      downloadBlobFile(filename, blob);

      notifications.show({
        title: "Instalador descargado",
        message: `Paquete ${platform} descargado correctamente.`,
      });
    } catch (error: any) {
      notifications.show({
        title: "Error descargando instalador",
        message: error?.message ?? "Error desconocido",
        color: "red",
      });
    } finally {
      setInstallerDownloadingPlatform(null);
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <div>
              <Title order={3}>Agentes remotos</Title>
              <Text c="dimmed" size="sm">
                Gestiona instalacion → agente → enrolamiento → trabajos de escaneo remotos.
              </Text>
            </div>
          <Button
            onClick={() => setCreatedAgent(null)}
            variant="light"
            disabled={!createdAgent}
          >
            Cerrar panel de enrolamiento
          </Button>
        </Group>

        <Stack mt="md" gap="sm">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
            label="Instalacion"
          />

          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Nombre del agente"
              placeholder="Puesto-sede-01"
              value={agentName}
              onChange={(event) => setAgentName(event.currentTarget.value)}
            />
            <TextInput
              label="Codigo opcional"
              placeholder="AG-NODE-01"
              value={agentCode}
              onChange={(event) => setAgentCode(event.currentTarget.value)}
            />
            <Button
              loading={createAgentMutation.isPending}
              disabled={!selectedAbonadoMm}
              onClick={() => createAgentMutation.mutate()}
            >
              Crear agente
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Estado de agentes</Title>
          <Text c="dimmed" size="sm">
            {selectedAbonadoMm ?? "-"}
          </Text>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover withColumnBorders withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Codigo</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Host</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Version</Table.Th>
                <Table.Th>Ultima conexion</Table.Th>
                <Table.Th>IP</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {agentsQuery.isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Center>Loading...</Center>
                  </Table.Td>
                </Table.Tr>
              ) : (agentsQuery.data ?? []).length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed">No hay agentes para esta instalacion.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                (agentsQuery.data ?? []).map((agent) => (
                  <Table.Tr key={agent.id}>
                    <Table.Td>{agent.agentCode}</Table.Td>
                    <Table.Td>{agent.friendlyName ?? "-"}</Table.Td>
                    <Table.Td>{agent.hostName ?? "-"}</Table.Td>
                    <Table.Td>{agentStatusBadge(agent)}</Table.Td>
                    <Table.Td>{agent.currentVersion ?? "-"}</Table.Td>
                    <Table.Td>{formatDate(agent.lastSeenAt)}</Table.Td>
                    <Table.Td>{agent.lastIpAddress ?? "-"}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        disabled={agent.isRevoked}
                        color="red"
                        variant="subtle"
                        aria-label={`Revocar ${agent.agentCode}`}
                        onClick={() => revokeAgentMutation.mutate(agent.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Trabajos de agentes</Title>
          <Button
            leftSection={<IconPlayerPause size={16} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["agentJobs", installationId] })}
            loading={jobsQuery.isFetching}
            size="sm"
            variant="light"
          >
            Refrescar
          </Button>
        </Group>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Group align="flex-end" wrap="wrap">
              <Select
                label="Red"
                searchable
                data={networkOptions}
                value={jobNetworkIdText}
                onChange={(value) => setJobNetworkIdText(value || "")}
                style={{ minWidth: 280 }}
                placeholder="Selecciona red"
                disabled={networksQuery.isLoading}
              />
              <NumberInput
                label="Priority"
                min={1}
                max={999}
                value={jobPriority}
                onChange={(value) => setJobPriority(Number(value ?? 1))}
                style={{ minWidth: 120 }}
              />
              <TextInput
                label="Puertos"
                placeholder="80,443,554,1935"
                value={jobPorts}
                onChange={(event) => setJobPorts(event.currentTarget.value)}
                style={{ minWidth: 200 }}
              />
              <TextInput
                label="Protocolos"
                placeholder="http,https"
                value={jobProtocols}
                onChange={(event) => setJobProtocols(event.currentTarget.value)}
                style={{ minWidth: 200 }}
              />
            </Group>

            <Group align="flex-end" wrap="wrap">
              <NumberInput
                label="Timeout ms"
                min={200}
                max={30000}
                value={jobTimeoutMs}
                onChange={(value) => setJobTimeoutMs(Number(value ?? 2000))}
                style={{ minWidth: 140 }}
              />
              <NumberInput
                label="Concurrency"
                min={1}
                max={1000}
                value={jobConcurrency}
                onChange={(value) => setJobConcurrency(Number(value ?? 100))}
                style={{ minWidth: 160 }}
              />
              <NumberInput
                label="SSDP ms"
                min={200}
                max={30000}
                value={jobSsdpMs}
                onChange={(value) => setJobSsdpMs(Number(value ?? 4200))}
                style={{ minWidth: 140 }}
              />
              <TextInput
                label="Scope"
                value={jobScope}
                onChange={(event) => setJobScope(event.currentTarget.value)}
                style={{ minWidth: 140 }}
              />
              <Select
                label="Apply mode"
                data={[
                  { value: "", label: "Default" },
                  { value: "NoDegrade", label: "NoDegrade" },
                  { value: "LastWins", label: "LastWins" },
                  { value: "Review", label: "Review" },
                ]}
                value={jobApplyMode}
                onChange={(value) => setJobApplyMode((value as "" | "NoDegrade" | "LastWins" | "Review") ?? "")}
                style={{ minWidth: 160 }}
              />
              <Checkbox
                label="Use Ssdp"
                checked={jobUseSsdp}
                onChange={(event) => setJobUseSsdp(event.currentTarget.checked)}
              />
              <Button
                loading={createJobMutation.isPending}
                disabled={installationId == null || !jobNetworkId}
                onClick={() => createJobMutation.mutate()}
              >
                Crear trabajo
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md" mt="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Cola de trabajos</Title>
            <Select
              label="Filtrar estado"
              value={jobStatusFilter}
              data={[
                { value: "all", label: "Todos" },
                { value: "Queued", label: "Queued" },
                { value: "Dispatched", label: "Dispatched" },
                { value: "Running", label: "Running" },
                { value: "Completed", label: "Completed" },
                { value: "Failed", label: "Failed" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
              onChange={(value) => setJobStatusFilter(value ?? "all")}
            />
          </Group>

          <ScrollArea>
            <Table striped highlightOnHover withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Id</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Estatus</Table.Th>
                  <Table.Th>Network</Table.Th>
                  <Table.Th>AgentId</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th>Inicio</Table.Th>
                  <Table.Th>Ultima act.</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {jobsQuery.isLoading ? (
                  <Table.Tr>
                        <Table.Td colSpan={9}>
                        <Center>Loading...</Center>
                      </Table.Td>
                  </Table.Tr>
                ) : filteredJobs.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text c="dimmed">
                        {installationId == null ? "Selecciona instalacion" : "Sin trabajos pendientes."}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                      filteredJobs.map((job: AgentJobDto) => {
                    const terminal = terminalJobStatuses.has(job.status);
                    return (
                      <Table.Tr key={job.id}>
                        <Table.Td>{job.id}</Table.Td>
                        <Table.Td>{job.jobType}</Table.Td>
                        <Table.Td>{jobStatusBadge(job.status)}</Table.Td>
                        <Table.Td>{job.targetNetworkCidr}</Table.Td>
                        <Table.Td>{job.assignedAgentId ?? "-"}</Table.Td>
                        <Table.Td>{`${job.progressPercent}%`}</Table.Td>
                        <Table.Td>{formatDate(job.startedAt)}</Table.Td>
                        <Table.Td>{job.lastProgressMessage ?? "-"}</Table.Td>
                        <Table.Td>
                          <ActionIcon
                            disabled={terminal || cancelJobMutation.isPending}
                            color="red"
                            variant="subtle"
                            aria-label={`Cancelar trabajo ${job.id}`}
                            onClick={() => cancelJobMutation.mutate(job.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      </Card>

      <Modal
        opened={createdAgent != null}
        onClose={() => setCreatedAgent(null)}
        title="Credenciales de enrolamiento del agente"
      >
        <Stack gap="sm">
          {createdAgent ? (
            <>
              <Text size="sm">
                AgentId: <strong>{createdAgent.agentId}</strong>
              </Text>
              <Text size="sm">
                AgentCode: <strong>{createdAgent.agentCode}</strong>
              </Text>
              <TextInput label="Enrollment Token" value={createdAgent.enrollmentToken} readOnly />
              <TextInput
                label="Hub URL"
                value={createdAgent.hubUrl}
                readOnly
                description="Usa este URL para que el agente se conecte."
              />
              <Textarea
                label="Snippet de enrolamiento"
                value={enrollmentSnippet}
                readOnly
                minRows={3}
                autosize
              />
              <Group justify="flex-end">
                <Button
                  variant="light"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => copyText(createdAgent.enrollmentToken)}
                >
                  Copiar token
                </Button>
                <Button
                  variant="subtle"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => copyText(enrollmentSnippet)}
                >
                  Copiar snippet
                </Button>
              </Group>
              <Group gap="xs" mt="xs">
                <Button
                  leftSection={<IconCopy size={16} />}
                  onClick={() =>
                    copyText(
                      `${installerBaseUrl}?token=${encodeURIComponent(createdAgent.enrollmentToken)}&platform=windows`,
                    )
                  }
                  variant="default"
                >
                  Copiar URL instalador (Windows)
                </Button>
                <Button
                  leftSection={<IconCopy size={16} />}
                  onClick={() =>
                    copyText(
                      `${installerBaseUrl}?token=${encodeURIComponent(createdAgent.enrollmentToken)}&platform=linux`,
                    )
                  }
                  variant="default"
                >
                  Copiar URL instalador (Linux)
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  loading={installerDownloadingPlatform === "windows"}
                  onClick={() => downloadInstaller("windows")}
                  variant="default"
                >
                  Descargar instalador (Windows)
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  loading={installerDownloadingPlatform === "linux"}
                  onClick={() => downloadInstaller("linux")}
                  variant="default"
                >
                  Descargar instalador (Linux)
                </Button>
                <Button leftSection={<IconCheck size={16} />} variant="default">
                  Ok
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                El endpoint de instalador ya está activo y genera paquetes con script de enrolamiento para Windows y Linux.
              </Text>
            </> 
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}
