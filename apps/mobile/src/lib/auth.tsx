import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Capability, MeResponse, Role } from '@manage/contracts';
import { Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { ensureDeviceId } from './device';
import { authClient } from './session';

type AuthValue = {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<MeResponse | null>;
  signIn: (email: string, password: string) => Promise<'signed-in' | 'totp'>;
  verifyTotp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  capabilities: Capability[];
  roles: Role[];
  isOwner: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  hasCapability: (capability: Capability) => boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

function toError(cause: unknown, fallback: string): Error {
  const record = cause as { message?: string; error?: { message?: string } } | null;
  const message = record?.error?.message ?? record?.message ?? fallback;
  return new Error(message);
}

async function registerDevice(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const deviceId = await ensureDeviceId();
    await api.registerDevice({
      deviceId,
      platform: Platform.OS,
      pushEnabled: false,
      pushToken: null,
      appVersion: '0.1.0',
    });
  } catch {
    // Device registration must never block sign-in; it is retried on the next refresh.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const registeredFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.me();
      setMe(next);
      setError(null);
      if (registeredFor.current !== next.user.id) {
        registeredFor.current = next.user.id;
        void registerDevice();
      }
      return next;
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 401) {
        setMe(null);
        setError(null);
        return null;
      }
      setError(toError(cause, 'Your workspace could not be loaded.').message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw toError(result.error, 'Sign-in did not complete. Try again.');
      const data = result.data as { twoFactorRedirect?: boolean } | null;
      if (data?.twoFactorRedirect) return 'totp' as const;
      await refresh();
      return 'signed-in' as const;
    },
    [refresh],
  );

  const verifyTotp = useCallback(
    async (code: string) => {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) throw toError(result.error, 'That code was not accepted.');
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      registeredFor.current = null;
      setMe(null);
      await AsyncStorage.multiRemove(['manage.activeShift', 'manage.queue.v1', 'manage.observations.v1']);
    }
  }, []);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      await api.switchOrganization(organizationId);
      await refresh();
    },
    [refresh],
  );

  const roles = useMemo<Role[]>(() => {
    if (!me) return [];
    return [
      ...new Set(
        me.memberships.filter((entry) => entry.status === 'ACTIVE').map((entry) => entry.role),
      ),
    ];
  }, [me]);

  const capabilities = useMemo<Capability[]>(() => me?.capabilities ?? [], [me]);
  const hasCapability = useCallback(
    (capability: Capability) => capabilities.includes(capability),
    [capabilities],
  );

  const value = useMemo<AuthValue>(
    () => ({
      me,
      loading,
      error,
      refresh,
      signIn,
      verifyTotp,
      signOut,
      switchOrganization,
      capabilities,
      roles,
      isOwner: roles.includes('SITE_OWNER'),
      isStaff: roles.includes('STAFF'),
      isAdmin: roles.includes('PLATFORM_ADMIN'),
      hasCapability,
    }),
    [me, loading, error, refresh, signIn, verifyTotp, signOut, switchOrganization, capabilities, roles, hasCapability],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
