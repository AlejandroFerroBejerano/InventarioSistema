import { http } from "./http";

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken?: string;
  tokenType?: string;
  expiresAtUtc?: string;
  sessionId?: string;
  refreshToken?: string;
  refreshTokenExpiresAtUtc?: string;
  userId?: string;
  displayName?: string;
  email?: string;
  roles?: string[];
  requiresMfa?: boolean;
  mfaChallengeToken?: string;
  mfaChallengeExpiresAtUtc?: string;
  message?: string;
};

export type LogoutRequest = {
  sessionId: string;
};

export type MfaVerifyRequest = {
  mfaChallengeToken: string;
  code: string;
  useRecoveryCode: boolean;
};

export type MfaSetupResponse = {
  userId: string;
  isEnabled: boolean;
  manualEntryCode?: string;
  qrCodeUri?: string;
};

export type MfaRecoveryResponse = {
  recoveryCodes: string[];
};

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/api/auth/login", req);
  return data;
}

export async function verifyMfa(req: MfaVerifyRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/api/auth/mfa/verify", req);
  return data;
}

export async function logout(sessionId?: string) {
  await http.post("/api/auth/logout", sessionId ? ({ sessionId } as LogoutRequest) : {});
}

export async function getMfaSetup(userId?: string): Promise<MfaSetupResponse> {
  const { data } = await http.post<MfaSetupResponse>("/api/auth/mfa/setup", null, {
    params: userId ? { userId } : undefined,
  });
  return data;
}

export async function confirmMfa(code: string, userId?: string): Promise<MfaRecoveryResponse> {
  const { data } = await http.post<MfaRecoveryResponse>("/api/auth/mfa/confirm", {
    code,
    userId,
  });
  return data;
}

export async function disableMfa(userId?: string) {
  await http.post("/api/auth/mfa/disable", { userId });
}

export async function regenerateRecoveryCodes(userId?: string): Promise<MfaRecoveryResponse> {
  const { data } = await http.post<MfaRecoveryResponse>("/api/auth/mfa/recovery", null, {
    params: userId ? { userId } : undefined,
  });
  return data;
}
