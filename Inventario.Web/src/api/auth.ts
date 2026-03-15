import { http } from "./http";

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresAtUtc: string;
  sessionId: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
};

export type LogoutRequest = {
  sessionId: string;
};

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/api/auth/login", req);
  return data;
}

export async function logout(sessionId?: string) {
  await http.post("/api/auth/logout", sessionId ? ({ sessionId } as LogoutRequest) : {});
}
