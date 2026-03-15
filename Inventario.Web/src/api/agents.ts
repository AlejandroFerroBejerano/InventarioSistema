import { http } from "./http";

export type AgentDto = {
  id: number;
  agentCode: string;
  friendlyName?: string | null;
  installationId?: number | null;
  installationAbonadoMm?: string | null;
  hostName?: string | null;
  os?: string | null;
  architecture?: string | null;
  currentVersion?: string | null;
  status: string;
  isOnline: boolean;
  isRevoked: boolean;
  lastSeenAt?: string | null;
  lastHeartbeatAt?: string | null;
  lastIpAddress?: string | null;
};

export type CreateAgentRequest = {
  installationId?: number | null;
  friendlyName?: string | null;
  agentCode?: string | null;
};

export type CreateAgentResponse = {
  agentId: number;
  agentCode: string;
  enrollmentToken: string;
  hubUrl: string;
  message: string;
};

export type RevokeAgentResponse = void;

export type AgentJobDto = {
  id: number;
  jobType: string;
  status: string;
  installationId?: number | null;
  installationAbonadoMm?: string | null;
  networkId?: number | null;
  targetNetworkCidr: string;
  assignedAgentId?: number | null;
  priority: number;
  progressPercent: number;
  lastProgressMessage?: string | null;
  errorMessage?: string | null;
  scanRunId?: number | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type CreateAgentScanJobRequest = {
  jobType: string;
  installationId?: number | null;
  abonadoMm?: string | null;
  networkId?: number | null;
  networkCidr?: string | null;
  ports?: number[] | null;
  protocols?: string[] | null;
  connectTimeoutMs?: number | null;
  maxConcurrency?: number | null;
  useSsdp?: boolean | null;
  ssdpListenMs?: number | null;
  scope?: string | null;
  applyMode?: string | null;
  priority?: number | null;
};

export async function getAgents(installationId?: number | null) {
  const res = await http.get<AgentDto[]>("/api/agents", {
    params: installationId != null ? { installationId } : undefined,
  });
  return res.data;
}

export async function createAgent(payload: CreateAgentRequest) {
  const res = await http.post<CreateAgentResponse>("/api/agents", payload);
  return res.data;
}

export async function downloadAgentInstaller(agentId: number, token: string, platform: "windows" | "linux" = "windows") {
  const res = await http.get<Blob>(`/api/agents/${agentId}/installer`, {
    params: { token, platform },
    responseType: "blob",
  });
  return res;
}

export async function revokeAgent(id: number) {
  await http.post(`/api/agents/${id}/revoke`);
}

export async function getAgentJobs(filters?: {
  installationId?: number | null;
  agentId?: number | null;
  status?: string | null;
  take?: number | null;
}) {
  const res = await http.get<AgentJobDto[]>("/api/agentjobs", {
    params: {
      ...(filters?.installationId != null ? { installationId: filters.installationId } : {}),
      ...(filters?.agentId != null ? { agentId: filters.agentId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.take ? { take: filters.take } : {}),
    },
  });
  return res.data;
}

export async function createAgentJob(payload: CreateAgentScanJobRequest) {
  const res = await http.post<AgentJobDto>("/api/agentjobs", payload);
  return res.data;
}

export async function cancelAgentJob(id: number) {
  await http.post(`/api/agentjobs/${id}/cancel`);
}
