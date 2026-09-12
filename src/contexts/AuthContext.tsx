import type { AuthProviders, User } from '@shared/api';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

type AuthState = {
  user: User | null;
  /** Which sign-in providers this deployment has credentials for. */
  providers: AuthProviders;
  loading: boolean;
  /** The server is unreachable — the session is assumed intact, not ended. */
  offline: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const NO_PROVIDERS: AuthProviders = { gitlab: false, google: false, github: false };

/**
 * Community edition: no network auth. Always anonymous, never calls /api/me.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const refresh = useCallback(async () => {}, []);
  const logout = useCallback(async () => {}, []);

  const value = useMemo<AuthState>(
    () => ({
      user: null,
      providers: NO_PROVIDERS,
      loading: false,
      offline: false,
      refresh,
      logout,
    }),
    [refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
