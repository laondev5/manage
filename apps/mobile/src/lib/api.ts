import { ApiClient, ApiClientError } from '@manage/api-client';
import { Platform } from 'react-native';
import { authClient } from './session';
import { API_URL } from './config';

export { API_URL };

export const api = new ApiClient({
  baseUrl: API_URL,
  clientKind: 'native',
  getHeaders: async () => {
    // On web the browser owns the session cookie; sending a Cookie header is
    // forbidden and would force a failing preflight.
    if (Platform.OS === 'web') return {};
    const cookie = await authClient.getCookie();
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;
    return headers;
  },
});

export const publicApi = new ApiClient({
  baseUrl: API_URL,
  clientKind: 'native',
});

export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function codeOf(error: unknown): string {
  return error instanceof ApiClientError ? error.code : 'UNKNOWN';
}

export function fieldsOf(error: unknown): Record<string, string[]> {
  return error instanceof ApiClientError ? (error.fields ?? {}) : {};
}
