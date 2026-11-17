import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from './ids';

const DEVICE_KEY = 'manage.deviceId';

export async function ensureDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = newId();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}
