import { http } from "./http";

export type UserSessionDto = {
  id: number;
  sessionId: string;
  createdAtUtc: string;
  lastActiveAtUtc?: string | null;
  expiresAtUtc: string;
  isRevoked: boolean;
  revokedAtUtc?: string | null;
  revokedByUserId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
};

export async function getSessions() {
  const { data } = await http.get<UserSessionDto[]>("/api/auth/sessions");
  return data;
}

export async function revokeSession(sessionId: string) {
  await http.post("/api/auth/logout", { sessionId });
}
