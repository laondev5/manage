import { ApiClientError } from '@manage/api-client';

/**
 * Browser requests stay on the web origin and are proxied to the API by the
 * rewrites in next.config.ts. That keeps Better Auth cookies first-party, which
 * `sameSite=lax` requires. Server rendering still needs an absolute origin.
 */
const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const serverOrigin = (
  process.env.API_ORIGIN ??
  process.env.API_BASE_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

export const API_BASE =
  configured || (typeof window === 'undefined' ? serverOrigin : '');

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  orgId?: string | null;
  signal?: AbortSignal;
  raw?: boolean;
};

let csrfToken: string | null = null;

export function resetCsrfCache() {
  csrfToken = null;
}

async function loadCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/api/v1/csrf`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ApiClientError(response.status, {
      code: 'UNAUTHENTICATED',
      message: 'Your session has ended. Sign in again.',
      requestId: response.headers.get('x-request-id') ?? 'unknown',
    });
  }
  const payload = (await response.json()) as { token: string };
  csrfToken = payload.token;
  return csrfToken;
}

export async function api<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.orgId) headers['X-Organization-Id'] = options.orgId;
  if (method !== 'GET') headers['X-CSRF-Token'] = await loadCsrf();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (options.raw && response.ok) return (await response.text()) as T;
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    const error = payload as {
      error?: { code: string; message: string; fields?: Record<string, string[]>; requestId: string };
      message?: string;
    };
    throw new ApiClientError(
      response.status,
      error.error ?? {
        code: 'INTERNAL_ERROR',
        message: error.message ?? 'The request could not be completed.',
        requestId: response.headers.get('x-request-id') ?? 'unknown',
      },
    );
  }
  return payload as T;
}

/** Unauthenticated API route (invitation preview/accept, health). No CSRF, no org header. */
export async function publicApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };
  if (!response.ok) {
    const error = payload as {
      error?: { code: string; message: string; fields?: Record<string, string[]>; requestId: string };
      message?: string;
    };
    throw new ApiClientError(
      response.status,
      error.error ?? {
        code: 'INTERNAL_ERROR',
        message: error.message ?? 'The request could not be completed.',
        requestId: response.headers.get('x-request-id') ?? 'unknown',
      },
    );
  }
  return payload as T;
}

export class AuthRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
  }
}

async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}/api/auth${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    twoFactorRedirect?: boolean;
    token?: string;
    totpURI?: string;
    backupCodes?: string[];
  };
  if (!response.ok) {
    throw new AuthRequestError(
      response.status,
      payload.message ?? 'The request could not be completed.',
      payload.code ?? 'AUTH_ERROR',
    );
  }
  return payload as T;
}

export const authApi = {
  signIn: (email: string, password: string) =>
    authRequest<{ twoFactorRedirect?: boolean; token?: string }>('/sign-in/email', {
      email,
      password,
    }),
  verifyTotp: (code: string) => authRequest<{ token?: string }>('/two-factor/verify-totp', { code }),
  signOut: () => authRequest<{ success?: boolean }>('/sign-out'),
  enableTwoFactor: (password: string) =>
    authRequest<{ totpURI: string; backupCodes: string[] }>('/two-factor/enable', { password }),
  verifyTwoFactorSetup: (code: string) =>
    authRequest<{ token?: string }>('/two-factor/verify-totp', { code }),
  requestPasswordReset: (email: string, redirectTo: string) =>
    authRequest<{ status: boolean }>('/request-password-reset', { email, redirectTo }),
  resetPassword: (token: string, newPassword: string) =>
    authRequest<{ status: boolean }>('/reset-password', { token, newPassword }),
  resendVerification: (email: string, callbackURL: string) =>
    authRequest<{ status: boolean }>('/send-verification-email', { email, callbackURL }),
};

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof AuthRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function errorCode(error: unknown): string | null {
  if (error instanceof ApiClientError) return error.code;
  if (error instanceof AuthRequestError) return error.code;
  return null;
}

export function fieldErrors(error: unknown): Record<string, string[]> {
  if (error instanceof ApiClientError && error.fields) return error.fields;
  return {};
}
