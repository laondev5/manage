import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';

import { API_URL } from './config';

export { API_URL };

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: 'manage',
      storagePrefix: 'manage',
      storage: SecureStore,
    }),
    twoFactorClient(),
  ],
});

export type SessionData = typeof authClient.$Infer.Session;

export function deviceLabel(): string {
  const model = Constants.deviceName ?? 'Mobile device';
  return `${model} · ${Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Device'}`;
}
