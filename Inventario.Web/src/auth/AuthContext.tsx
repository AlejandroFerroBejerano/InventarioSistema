import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  login as loginApi,
  logout as logoutApi,
  verifyMfa as verifyMfaApi,
  type LoginResponse,
  type MfaVerifyRequest,
} from "../api/auth";
import { setAuthToken, clearAuthToken } from "../api/http";

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tokenType: string;
  expiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  sessionId: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyMfa: (mfaChallengeToken: string, code: string, useRecoveryCode: boolean) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  hasAnyRole: (roles: string[]) => boolean;
};

const AUTH_STORAGE_KEY = "inventario.auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<StoredSession | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (stored?.accessToken) {
      setAuthToken(stored.accessToken);
    } else {
      clearAuthToken();
    }
    setIsLoading(false);
  }, [stored]);

  const login = async (email: string, password: string) => {
    const response = await loginApi({ email, password });
    if (!response.requiresMfa && response.accessToken && response.sessionId && response.refreshToken) {
      const next: StoredSession = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        sessionId: response.sessionId,
        tokenType: response.tokenType ?? "Bearer",
        expiresAtUtc: response.expiresAtUtc ?? new Date().toISOString(),
        refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc ?? new Date().toISOString(),
        userId: response.userId ?? "",
        displayName: response.displayName ?? "",
        email: response.email ?? "",
        roles: response.roles ?? [],
      };

      setStored(next);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      setAuthToken(next.accessToken);
    }
    return response;
  };

  const verifyMfa = async (mfaChallengeToken: string, code: string, useRecoveryCode: boolean) => {
    const response = await verifyMfaApi({ mfaChallengeToken, code, useRecoveryCode } as MfaVerifyRequest);
    if (!response.accessToken || !response.sessionId || !response.refreshToken) {
      throw new Error("MFA verification response is incomplete.");
    }

    const next: StoredSession = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      sessionId: response.sessionId,
      tokenType: response.tokenType ?? "Bearer",
      expiresAtUtc: response.expiresAtUtc ?? new Date().toISOString(),
      refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc ?? new Date().toISOString(),
      userId: response.userId ?? "",
      displayName: response.displayName ?? "",
      email: response.email ?? "",
      roles: response.roles ?? [],
    };

    setStored(next);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    setAuthToken(next.accessToken);
    return response;
  };

  const logout = async () => {
    if (stored?.sessionId) {
      await logoutApi(stored.sessionId).catch(() => {});
    }
    clear();
  };

  const clear = () => {
    setStored(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearAuthToken();
  };

  const hasAnyRole = (roles: string[]) => {
    if (!stored?.roles || roles.length === 0) return false;
    return stored.roles.some((role) => roles.includes(role));
  };

  const context = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(stored && stored.accessToken),
      isLoading,
      user: stored
        ? {
            userId: stored.userId,
            displayName: stored.displayName,
            email: stored.email,
            roles: stored.roles,
          }
        : null,
      accessToken: stored?.accessToken ?? null,
      sessionId: stored?.sessionId ?? null,
      refreshToken: stored?.refreshToken ?? null,
      login,
      verifyMfa,
      logout,
      hasAnyRole,
    }),
    [stored, isLoading]
  );

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
