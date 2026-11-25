import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import type { Permission } from "@/shared/constants";
import type { AuthPayload, SessionUser } from "@/shared/types";
import { ApiError, api, setCsrfToken, setUnauthorizedHandler } from "../services/api";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...permissions: Permission[]) => boolean;
  clear: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const queryClient = useQueryClient();

  const clear = React.useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    queryClient.clear();
  }, [queryClient]);

  React.useEffect(() => {
    setUnauthorizedHandler(clear);
    api
      .get<AuthPayload>("/api/auth/me")
      .then((r) => {
        setCsrfToken(r.csrfToken);
        setUser(r.user);
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => setLoading(false));
  }, [clear]);

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      loading,
      clear,
      login: async (email, password) => {
        const r = await api.post<AuthPayload>("/api/auth/login", { email, password });
        setCsrfToken(r.csrfToken);
        setUser(r.user);
      },
      logout: async () => {
        try {
          await api.post("/api/auth/logout");
        } finally {
          clear();
        }
      },
      can: (...permissions) => !!user && permissions.some((p) => user.permissions.includes(p)),
    }),
    [user, loading, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
