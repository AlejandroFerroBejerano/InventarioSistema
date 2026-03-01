import { http } from "./http";

export type ScanRunListItem = {
  id: number;
  networkId: number | null;
  networkCidr: string;
  startedAt: string;
  finishedAt: string | null;
  totalHosts: number;
  authenticatedCount: number;
  identifiedCount: number;
  noPortsCount: number;
};

export type ScanHostResultDto = {
  ipAddress: string;
  status: string;
  openPortsJson: string;
  openPorts: number[];
  manufacturer?: string | null;
  model?: string | null;
  firmware?: string | null;
  serialNumber?: string | null;
  protocol?: string | null;
  webPort?: number | null;
  sdkPort?: number | null;
  credentialId?: number | null;
  errorMessage?: string | null;
};

export async function getScanRuns(abonadoMm: string) {
  const res = await http.get<ScanRunListItem[]>("/api/scanruns", {
    params: { abonadoMm },
  });
  return res.data;
}

export async function getScanRunHosts(scanRunId: number) {
  const res = await http.get<ScanHostResultDto[]>(`/api/scanruns/${scanRunId}/hosts`);
  return res.data;
}