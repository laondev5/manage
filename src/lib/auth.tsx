'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Capability, MeResponse } from '../contracts/index';
import { ApiClientError } from '../api-client/index';
import { api, authApi, errorMessage, resetCsrfCache, type ApiRequestOptions } from './api';

const ORG_KEY = 'manage.activeOrganization';

type AuthState = {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  activeOrgId: string | null;
  refresh: () => Promise<MeResponse | null>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  request: <T>(path: string, options?: ApiRequestOptions) => Promise<T>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const meRef = useRef<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const saved =
        typeof window === 'undefined' ? null : window.localStorage.getItem(ORG_KEY);
      const result = await api<MeResponse>('/api/v1/me', { orgId: saved });
      meRef.current = result;
      setMe(result);
      setError(null);
      const allowed = new Set(result.memberships.map((entry) => entry.organizationId));
      const nextOrg =
        (saved && allowed.has(saved) ? saved : null) ?? result.activeOrganizationId ?? null;
      setActiveOrgId(nextOrg);
      if (typeof window !== 'undefined' && nextOrg) {
        window.localStorage.setItem(ORG_KEY, nextOrg);
      }
      return result;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) {
        meRef.current = null;
        setMe(null);
        setError(null);
        return null;
      }
      setError(errorMessage(cause, 'We could not load your account.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } finally {
      resetCsrfCache();
      if (typeof window !== 'undefined') window.localStorage.removeItem(ORG_KEY);
      meRef.current = null;
      setMe(null);
      setActiveOrgId(null);
    }
  }, []);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      await api('/api/v1/me/organization', {
        method: 'POST',
        body: { organizationId },
        orgId: organizationId,
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ORG_KEY, organizationId);
      }
      setActiveOrgId(organizationId);
      await refresh();
    },
    [refresh],
  );

  const request = useCallback(
    <T,>(path: string, options: ApiRequestOptions = {}) =>
      api<T>(path, { ...options, orgId: options.orgId ?? activeOrgId }),
    [activeOrgId],
  );

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      error,
      activeOrgId,
      refresh,
      signOut,
      switchOrganization,
      request,
    }),
    [me, loading, error, activeOrgId, refresh, signOut, switchOrganization, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export function hasCapability(me: MeResponse | null, capability: Capability): boolean {
  return Boolean(me?.capabilities.includes(capability));
}

export function isAdmin(me: MeResponse | null): boolean {
  return Boolean(
    me?.memberships.some(
      (membership) => membership.role === 'PLATFORM_ADMIN' && membership.status === 'ACTIVE',
    ),
  );
}
