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
  IconKey,
  IconPlayerPause,
  IconTrash,
} from "@tabler/icons-react";
import { useI18n } from "../../app/i18n/AppI18nContext";
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
  regenerateEnrollmentToken,
  revokeAgent,
  type CreateAgentScanJobRequest,
} from "../../api/agents";

function agentStatusBadge(agent: AgentDto, t: (spanish: string, english: string) => string) {
  if (agent.isRevoked) {
    return (
      <Badge color="red" variant="light">
        {t("Revocado", "Revoked")}
      </Badge>
    );
  }

  if (agent.isOnline) {
    return (
      <Badge color="green" variant="light">
        {t("En linea", "Online")}
      </Badge>
    );
  }

  return (
    <Badge color="gray" variant="light">
      {t("Fuera de linea", "Offline")}
    </Badge>
  );
}

function jobStatusBadge(
  status: string,
  t: (spanish: string, english: string) => string
) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "completed") {
    return (
      <Badge color="green" variant="light">
        {t("Completado", "Completed")}
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
        {status === "Running" ? t("En ejecucion", "Running") : status === "Dispatched" ? t("Despachado", "Dispatched") : status}
      </Badge>
    );
  }

  return (
    <Badge color="yellow" variant="light">
      {status === "Queued" ? t("En cola", "Queued") : status}
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
  const { t, formatDateTime } = useI18n();
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
        title: t("Instalacion creada", "Installation created"),
        message: t("Ya puedes seleccionarla.", "You can select it now."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error creando instalacion", "Error creating installation"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
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
        throw new Error(t("Selecciona primero una instalacion.", "Select an installation first."));
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
        title: t("Agente creado", "Agent created"),
        message: t(
          "Guarda el token o regeneralo desde la tabla de agentes cuando lo necesites.",
          "Save the token or regenerate it from the agents table when needed."
        ),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error creando agente", "Error creating agent"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const revokeAgentMutation = useMutation({
    mutationFn: revokeAgent,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agents", installationId] });
      notifications.show({
        title: t("Agente revocado", "Agent revoked"),
        message: t(
          "El agente queda deshabilitado para nuevos trabajos.",
          "The agent is disabled for new jobs."
        ),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error revocando agente", "Error revoking agent"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const regenerateEnrollmentTokenMutation = useMutation({
    mutationFn: regenerateEnrollmentToken,
    onSuccess: (response) => {
      setCreatedAgent(response);
      notifications.show({
        title: t("Token regenerado", "Token regenerated"),
        message: t(
          "Ya puedes volver a descargar el instalador con el nuevo token.",
          "You can download the installer again with the new token."
        ),
      });
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      notifications.show({
        title: t("Error regenerando token", "Error regenerating token"),
        message:
          status === 404
            ? t(
                "El endpoint no existe en la API actual. Reinicia el backend y prueba de nuevo.",
                "The endpoint does not exist in the current API. Restart the backend and try again."
              )
            : error?.message ?? t("Error desconocido", "Unknown error"),
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
        throw new Error(t("Selecciona primero una instalacion.", "Select an installation first."));
      }

      if (!jobNetworkId) {
        throw new Error(t("Selecciona una red.", "Select a network."));
      }

      const network = networksQuery.data?.find((n) => n.id === jobNetworkId);
      if (!network) {
        throw new Error(t("Red invalida.", "Invalid network."));
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
        title: t("Trabajo enviado", "Job sent"),
        message: t(
          "El trabajo fue creado y enviado a un agente disponible.",
          "The job was created and sent to an available agent."
        ),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error creando trabajo", "Error creating job"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
        color: "red",
      });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: cancelAgentJob,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agentJobs", installationId] });
      notifications.show({
        title: t("Trabajo cancelado", "Job cancelled"),
        message: t("El estado quedo en cancelado.", "The job status is now cancelled."),
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: t("Error cancelando trabajo", "Error cancelling job"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
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
      title: t("Copiado", "Copied"),
      message: t("Texto copiado al portapapeles.", "Text copied to clipboard."),
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
        title: t("Instalador descargado", "Installer downloaded"),
        message:
          platform === "windows"
            ? t("Paquete Windows descargado correctamente.", "Windows package downloaded successfully.")
            : t("Paquete Linux descargado correctamente.", "Linux package downloaded successfully."),
      });
    } catch (error: any) {
      notifications.show({
        title: t("Error descargando instalador", "Error downloading installer"),
        message: error?.message ?? t("Error desconocido", "Unknown error"),
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
            <Title order={3}>{t("Agentes remotos", "Remote agents")}</Title>
            <Text c="dimmed" size="sm">
              {t(
                "Gestiona instalacion - agente - enrolamiento - trabajos de escaneo remotos.",
                "Manage installation, agent enrollment, and remote scan jobs."
              )}
            </Text>
          </div>
          <Button
            onClick={() => setCreatedAgent(null)}
            variant="light"
            disabled={!createdAgent}
          >
            {t("Cerrar panel de enrolamiento", "Close enrollment panel")}
          </Button>
        </Group>

        <Stack mt="md" gap="sm">
          <InstallationPicker
            installations={installationsQuery.data ?? []}
            value={selectedAbonadoMm}
            onChange={setSelectedAbonadoMm}
            loading={installationsQuery.isLoading}
            onCreate={(input) => createInstallationMutation.mutateAsync(input)}
            label={t("Instalacion", "Installation")}
          />

          <Group align="flex-end" wrap="wrap">
            <TextInput
              label={t("Nombre del agente", "Agent name")}
              placeholder={t("Puesto-sede-01", "Workstation-site-01")}
              value={agentName}
              onChange={(event) => setAgentName(event.currentTarget.value)}
            />
            <TextInput
              label={t("Codigo opcional", "Optional code")}
              placeholder="AG-NODE-01"
              value={agentCode}
              onChange={(event) => setAgentCode(event.currentTarget.value)}
            />
            <Button
              loading={createAgentMutation.isPending}
              disabled={!selectedAbonadoMm}
              onClick={() => createAgentMutation.mutate()}
            >
              {t("Crear agente", "Create agent")}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>{t("Estado de agentes", "Agent status")}</Title>
          <Text c="dimmed" size="sm">
            {selectedAbonadoMm ?? "-"}
          </Text>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover withColumnBorders withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Codigo", "Code")}</Table.Th>
                <Table.Th>{t("Nombre", "Name")}</Table.Th>
                <Table.Th>{t("Host", "Host")}</Table.Th>
                <Table.Th>{t("Estado", "Status")}</Table.Th>
                <Table.Th>{t("Version", "Version")}</Table.Th>
                <Table.Th>{t("Ultima conexion", "Last connection")}</Table.Th>
                <Table.Th>IP</Table.Th>
                <Table.Th>{t("Acciones", "Actions")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {agentsQuery.isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Center>{t("Cargando...", "Loading...")}</Center>
                  </Table.Td>
                </Table.Tr>
              ) : (agentsQuery.data ?? []).length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed">
                      {t("No hay agentes para esta instalacion.", "There are no agents for this installation.")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                (agentsQuery.data ?? []).map((agent) => (
                  <Table.Tr key={agent.id}>
                    <Table.Td>{agent.agentCode}</Table.Td>
                    <Table.Td>{agent.friendlyName ?? "-"}</Table.Td>
                    <Table.Td>{agent.hostName ?? "-"}</Table.Td>
                    <Table.Td>{agentStatusBadge(agent, t)}</Table.Td>
                    <Table.Td>{agent.currentVersion ?? "-"}</Table.Td>
                    <Table.Td>{formatDateTime(agent.lastSeenAt)}</Table.Td>
                    <Table.Td>{agent.lastIpAddress ?? "-"}</Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <ActionIcon
                          disabled={agent.isRevoked || regenerateEnrollmentTokenMutation.isPending}
                          color="yellow"
                          variant="subtle"
                          aria-label={`${t("Regenerar token", "Regenerate token")} ${agent.agentCode}`}
                          onClick={() => regenerateEnrollmentTokenMutation.mutate(agent.id)}
                        >
                          <IconKey size={16} />
                        </ActionIcon>
                        <ActionIcon
                          disabled={agent.isRevoked}
                          color="red"
                          variant="subtle"
                          aria-label={`${t("Revocar", "Revoke")} ${agent.agentCode}`}
                          onClick={() => revokeAgentMutation.mutate(agent.id)}
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
        </ScrollArea>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>{t("Trabajos de agentes", "Agent jobs")}</Title>
          <Button
            leftSection={<IconPlayerPause size={16} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["agentJobs", installationId] })}
            loading={jobsQuery.isFetching}
            size="sm"
            variant="light"
          >
            {t("Refrescar", "Refresh")}
          </Button>
        </Group>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Group align="flex-end" wrap="wrap">
              <Select
                label={t("Red", "Network")}
                searchable
                data={networkOptions}
                value={jobNetworkIdText}
                onChange={(value) => setJobNetworkIdText(value || "")}
                style={{ minWidth: 280 }}
                placeholder={t("Selecciona red", "Select network")}
                disabled={networksQuery.isLoading}
              />
              <NumberInput
                label={t("Prioridad", "Priority")}
                min={1}
                max={999}
                value={jobPriority}
                onChange={(value) => setJobPriority(Number(value ?? 1))}
                style={{ minWidth: 120 }}
              />
              <TextInput
                label={t("Puertos", "Ports")}
                placeholder="80,443,554,1935"
                value={jobPorts}
                onChange={(event) => setJobPorts(event.currentTarget.value)}
                style={{ minWidth: 200 }}
              />
              <TextInput
                label={t("Protocolos", "Protocols")}
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
                label={t("Concurrencia", "Concurrency")}
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
                label={t("Ambito", "Scope")}
                value={jobScope}
                onChange={(event) => setJobScope(event.currentTarget.value)}
                style={{ minWidth: 140 }}
              />
              <Select
                label={t("Modo de aplicacion", "Apply mode")}
                data={[
                  { value: "", label: t("Por defecto", "Default") },
                  { value: "NoDegrade", label: "NoDegrade" },
                  { value: "LastWins", label: "LastWins" },
                  { value: "Review", label: t("Revision", "Review") },
                ]}
                value={jobApplyMode}
                onChange={(value) => setJobApplyMode((value as "" | "NoDegrade" | "LastWins" | "Review") ?? "")}
                style={{ minWidth: 160 }}
              />
              <Checkbox
                label={t("Usar SSDP", "Use SSDP")}
                checked={jobUseSsdp}
                onChange={(event) => setJobUseSsdp(event.currentTarget.checked)}
              />
              <Button
                loading={createJobMutation.isPending}
                disabled={installationId == null || !jobNetworkId}
                onClick={() => createJobMutation.mutate()}
              >
                {t("Crear trabajo", "Create job")}
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md" mt="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>{t("Cola de trabajos", "Job queue")}</Title>
            <Select
              label={t("Filtrar estado", "Filter by status")}
              value={jobStatusFilter}
              data={[
                { value: "all", label: t("Todos", "All") },
                { value: "Queued", label: t("En cola", "Queued") },
                { value: "Dispatched", label: t("Despachado", "Dispatched") },
                { value: "Running", label: t("En ejecucion", "Running") },
                { value: "Completed", label: t("Completado", "Completed") },
                { value: "Failed", label: t("Fallido", "Failed") },
                { value: "Cancelled", label: t("Cancelado", "Cancelled") },
              ]}
              onChange={(value) => setJobStatusFilter(value ?? "all")}
            />
          </Group>

          <ScrollArea>
            <Table striped highlightOnHover withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Id</Table.Th>
                  <Table.Th>{t("Tipo", "Type")}</Table.Th>
                  <Table.Th>{t("Estado", "Status")}</Table.Th>
                  <Table.Th>{t("Red", "Network")}</Table.Th>
                  <Table.Th>{t("Agente", "Agent")}</Table.Th>
                  <Table.Th>{t("Progreso", "Progress")}</Table.Th>
                  <Table.Th>{t("Inicio", "Started")}</Table.Th>
                  <Table.Th>{t("Ultima act.", "Last update")}</Table.Th>
                  <Table.Th>{t("Acciones", "Actions")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {jobsQuery.isLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Center>{t("Cargando...", "Loading...")}</Center>
                    </Table.Td>
                  </Table.Tr>
                ) : filteredJobs.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text c="dimmed">
                        {installationId == null
                          ? t("Selecciona instalacion", "Select an installation")
                          : t("Sin trabajos pendientes.", "There are no pending jobs.")}
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
                        <Table.Td>{jobStatusBadge(job.status, t)}</Table.Td>
                        <Table.Td>{job.targetNetworkCidr}</Table.Td>
                        <Table.Td>{job.assignedAgentId ?? "-"}</Table.Td>
                        <Table.Td>{`${job.progressPercent}%`}</Table.Td>
                        <Table.Td>{formatDateTime(job.startedAt)}</Table.Td>
                        <Table.Td>{job.lastProgressMessage ?? "-"}</Table.Td>
                        <Table.Td>
                          <ActionIcon
                            disabled={terminal || cancelJobMutation.isPending}
                            color="red"
                            variant="subtle"
                            aria-label={`${t("Cancelar trabajo", "Cancel job")} ${job.id}`}
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
        title={t("Credenciales de enrolamiento del agente", "Agent enrollment credentials")}
      >
        <Stack gap="sm">
          {createdAgent ? (
            <>
              <Text size="sm">
                {t("Id del agente", "Agent ID")}: <strong>{createdAgent.agentId}</strong>
              </Text>
              <Text size="sm">
                {t("Codigo del agente", "Agent code")}: <strong>{createdAgent.agentCode}</strong>
              </Text>
              <TextInput label={t("Token de enrolamiento", "Enrollment token")} value={createdAgent.enrollmentToken} readOnly />
              <TextInput
                label={t("URL del hub", "Hub URL")}
                value={createdAgent.hubUrl}
                readOnly
                description={t("Usa este URL para que el agente se conecte.", "Use this URL so the agent can connect.")}
              />
              <Textarea
                label={t("Snippet de enrolamiento", "Enrollment snippet")}
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
                  {t("Copiar token", "Copy token")}
                </Button>
                <Button
                  variant="subtle"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => copyText(enrollmentSnippet)}
                >
                  {t("Copiar snippet", "Copy snippet")}
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
                  {t("Copiar URL instalador (Windows)", "Copy installer URL (Windows)")}
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
                  {t("Copiar URL instalador (Linux)", "Copy installer URL (Linux)")}
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  loading={installerDownloadingPlatform === "windows"}
                  onClick={() => downloadInstaller("windows")}
                  variant="default"
                >
                  {t("Descargar instalador (Windows)", "Download installer (Windows)")}
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  loading={installerDownloadingPlatform === "linux"}
                  onClick={() => downloadInstaller("linux")}
                  variant="default"
                >
                  {t("Descargar instalador (Linux)", "Download installer (Linux)")}
                </Button>
                <Button leftSection={<IconCheck size={16} />} variant="default">
                  OK
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                {t(
                  "El endpoint de instalador ya esta activo y genera paquetes con script de enrolamiento para Windows y Linux.",
                  "The installer endpoint is already active and generates packages with enrollment scripts for Windows and Linux."
                )}
              </Text>
            </> 
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}
