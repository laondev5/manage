import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'manage.intro.v1';

let seenCache: boolean | null = null;
const listeners = new Set<(seen: boolean) => void>();

export async function isIntroSeen(): Promise<boolean> {
  if (seenCache !== null) return seenCache;
  try {
    seenCache = (await AsyncStorage.getItem(KEY)) === 'seen';
  } catch {
    seenCache = false;
  }
  return seenCache;
}

export async function markIntroSeen(): Promise<void> {
  seenCache = true;
  for (const listener of listeners) listener(true);
  try {
    await AsyncStorage.setItem(KEY, 'seen');
  } catch {
    // Losing the flag only means the introduction shows again next launch.
  }
}

export function useIntroSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(seenCache);
  useEffect(() => {
    if (seenCache === null) {
      void isIntroSeen().then(setSeen);
    }
    const listener = (value: boolean) => setSeen(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return seen;
}
