import Constants from 'expo-constants';

/**
 * In development the API runs on the same machine as Metro, so follow whatever
 * host Expo Go used to reach the bundler. That keeps the app working when the
 * laptop's Wi-Fi address changes between sessions.
 */
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

function resolve(configured: string | undefined, port: number) {
  return (configured?.trim() || `http://${devHost}:${port}`).replace(/\/$/, '');
}

export const API_URL = resolve(process.env.EXPO_PUBLIC_API_URL, 4000);
export const WEB_URL = resolve(process.env.EXPO_PUBLIC_WEB_URL, 3000);
