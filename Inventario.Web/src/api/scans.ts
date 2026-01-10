import { http } from "./http";

export type StartScanRequest = {
  abonadoMm: string;
  networkCidr: string;
  applyMode?: "LastWins" | "NoDegrade" | "Review";
  ports?: number[];
  connectTimeoutMs?: number;
  maxConcurrency?: number;
  useSsdp?: boolean;
  ssdpListenMs?: number;
  protocols?: string[];
};

export type ScanHostResultDto = {
  ip: string;
  openPorts: number[] | null;
  webPort?: number | null;

  protocol?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  firmware?: string | null;
  serialNumber?: string | null;

  status?: string | null;
  category?: string | null;

  credentialId?: number | null;
  credentialUsername?: string | null;
};

export type ScanResponseDto = {
  abonadoMm: string;
  networkCidr: string;
  startedAt: string;
  finishedAt?: string | null;
  hosts: ScanHostResultDto[];
};

export async function startScan(req: StartScanRequest): Promise<ScanResponseDto> {
  const { data } = await http.post<ScanResponseDto>("/api/scans", req);
  return data;
}
