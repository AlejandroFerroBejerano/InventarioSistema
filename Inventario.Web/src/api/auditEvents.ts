import { http } from "./http";

export type AuditEventDto = {
  id: number;
  timestampUtc: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  result: string;
  ipAddress?: string | null;
  correlationId?: string | null;
  detailsJson?: string | null;
};

export type AuditEventsResponse = {
  total: number;
  skip: number;
  take: number;
  items: AuditEventDto[];
};

export async function getAuditEvents(filters: {
  actorId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
  skip?: number;
  take?: number;
}) {
  const { data } = await http.get<AuditEventsResponse>("/api/auditEvents", {
    params: {
      actorId: filters.actorId?.trim() || undefined,
      action: filters.action?.trim() || undefined,
      resourceType: filters.resourceType?.trim() || undefined,
      fromUtc: filters.fromUtc || undefined,
      toUtc: filters.toUtc || undefined,
      skip: filters.skip ?? 0,
      take: filters.take ?? 200,
    },
  });

  return data;
}

export async function downloadAuditCsv(filters: {
  actorId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}) {
  const response = await http.get("/api/auditEvents/export/csv", {
    params: {
      actorId: filters.actorId?.trim() || undefined,
      action: filters.action?.trim() || undefined,
      resourceType: filters.resourceType?.trim() || undefined,
      fromUtc: filters.fromUtc || undefined,
      toUtc: filters.toUtc || undefined,
    },
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-events-${Date.now()}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAuditJson(filters: {
  actorId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}) {
  const response = await http.get("/api/auditEvents/export/json", {
    params: {
      actorId: filters.actorId?.trim() || undefined,
      action: filters.action?.trim() || undefined,
      resourceType: filters.resourceType?.trim() || undefined,
      fromUtc: filters.fromUtc || undefined,
      toUtc: filters.toUtc || undefined,
    },
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-events-${Date.now()}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
