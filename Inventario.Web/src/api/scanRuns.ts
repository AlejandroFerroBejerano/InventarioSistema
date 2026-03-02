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

export type ScanRunApplyMode = "NoDegrade" | "LastWins";

export type ScanRunApplyResult = {
  scanRunId: number;
  mode: ScanRunApplyMode;
  created: number;
  updated: number;
  skipped: number;
};

export async function getScanRuns(abonadoMm: string, networkId?: number | null) {
  const res = await http.get<ScanRunListItem[]>("/api/scanruns", {
    params: {
      abonadoMm,
      ...(networkId != null ? { networkId } : {}),
    },
  });
  return res.data;
}

export async function getScanRunHosts(scanRunId: number) {
  const res = await http.get<ScanHostResultDto[]>(`/api/scanruns/${scanRunId}/hosts`);
  return res.data;
}

export async function exportScanRunCsv(scanRunId: number) {
  const res = await http.get<Blob>(`/api/scanruns/${scanRunId}/export.csv`, {
    responseType: "blob",
  });

  let filename = `scanrun_${scanRunId}.csv`;
  const contentDisposition = res.headers["content-disposition"];
  if (contentDisposition) {
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition);
    if (match?.[1]) {
      filename = decodeURIComponent(match[1].replace(/"/g, "").trim());
    }
  }

  return { blob: res.data, filename };
}

export async function deleteScanRun(scanRunId: number, confirmation: string) {
  await http.delete(`/api/scanruns/${scanRunId}`, {
    data: { confirmation },
  });
}

export async function applyScanRun(scanRunId: number, mode: ScanRunApplyMode) {
  const res = await http.post<ScanRunApplyResult>(`/api/scanruns/${scanRunId}/apply`, null, {
    params: { mode },
  });
  return res.data;
}
