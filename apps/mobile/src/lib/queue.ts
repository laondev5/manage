import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceEventInput, LocationReading, PresenceState } from '@manage/contracts';
import { ApiClientError } from '@manage/api-client';
import { api } from './api';
import { newId } from './ids';
import { decryptJson, encryptJson, withLock } from './secure-store';

const QUEUE_KEY = 'manage.queue.v1';
const OBSERVATIONS_KEY = 'manage.observations.v1';
export const ACTIVE_SHIFT_KEY = 'manage.activeShift';

export type LocalShift = {
  clientShiftId: string;
  shiftId: string;
  siteId: string;
  siteName: string;
  policyVersion: number;
  radiusMeters: number;
  timezone: string;
  startedAt: string;
};

export type QueuedEvent = {
  id: string;
  idempotencyKey: string;
  event: AttendanceEventInput;
  queuedAt: string;
  lastError: string | null;
};

export type QueuedObservation = {
  id: string;
  shiftId: string;
  siteId: string;
  reading: LocationReading;
  capturedAt: string;
  lastError: string | null;
};

async function readList<T>(key: string): Promise<T[]> {
  return (await decryptJson<T[]>(await AsyncStorage.getItem(key))) ?? [];
}

async function writeList<T>(key: string, items: T[]): Promise<void> {
  if (!items.length) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, await encryptJson(items));
}

export function readQueue(): Promise<QueuedEvent[]> {
  return readList<QueuedEvent>(QUEUE_KEY);
}

export function enqueueEvent(event: AttendanceEventInput, idempotencyKey: string): Promise<QueuedEvent> {
  return withLock(async () => {
    const items = await readList<QueuedEvent>(QUEUE_KEY);
    const queued: QueuedEvent = {
      id: event.clientEventId,
      idempotencyKey,
      event,
      queuedAt: new Date().toISOString(),
      lastError: null,
    };
    await writeList(QUEUE_KEY, [...items.filter((item) => item.id !== queued.id), queued]);
    return queued;
  });
}

export type FlushResult = {
  accepted: number;
  rejected: number;
  remaining: number;
  lastError: string | null;
};

/** Sends queued clock events in order. Accepted or definitively rejected events leave the queue. */
export async function flushQueue(): Promise<FlushResult> {
  return withLock(async () => {
    const items = await readList<QueuedEvent>(QUEUE_KEY);
    if (!items.length) return { accepted: 0, rejected: 0, remaining: 0, lastError: null };
    const remaining: QueuedEvent[] = [];
    let accepted = 0;
    let rejected = 0;
    let lastError: string | null = null;
    for (const item of items) {
      try {
        await api.clock(item.event, item.idempotencyKey);
        accepted += 1;
      } catch (cause) {
        const status = cause instanceof ApiClientError ? cause.status : 0;
        const definitive = status >= 400 && status < 500 && status !== 408 && status !== 429;
        lastError = cause instanceof Error ? cause.message : 'The event could not be sent.';
        if (definitive) rejected += 1;
        else remaining.push({ ...item, lastError });
      }
    }
    await writeList(QUEUE_KEY, remaining);
    return { accepted, rejected, remaining: remaining.length, lastError };
  });
}

export async function removeQueuedEvent(id: string): Promise<void> {
  await withLock(async () => {
    const items = await readList<QueuedEvent>(QUEUE_KEY);
    await writeList(QUEUE_KEY, items.filter((item) => item.id !== id));
  });
}

export function readObservations(): Promise<QueuedObservation[]> {
  return readList<QueuedObservation>(OBSERVATIONS_KEY);
}

export function bufferObservation(
  input: Omit<QueuedObservation, 'id' | 'lastError'>,
): Promise<void> {
  return withLock(async () => {
    const items = await readList<QueuedObservation>(OBSERVATIONS_KEY);
    const next = [
      ...items,
      { ...input, id: `${input.shiftId}-${input.capturedAt}-${Math.random().toString(16).slice(2)}`, lastError: null },
    ].slice(-500);
    await writeList(OBSERVATIONS_KEY, next);
  });
}

export async function flushObservations(): Promise<{ accepted: number; remaining: number }> {
  return withLock(async () => {
    const items = await readList<QueuedObservation>(OBSERVATIONS_KEY);
    const remaining: QueuedObservation[] = [];
    let accepted = 0;
    for (const item of items) {
      try {
        await api.sendObservation({
          clientObservationId: newId(),
          shiftId: item.shiftId,
          siteId: item.siteId,
          latitude: item.reading.latitude,
          longitude: item.reading.longitude,
          accuracyMeters: item.reading.accuracyMeters,
          capturedAt: item.reading.capturedAt,
          source: 'BACKGROUND',
        });
        accepted += 1;
      } catch (cause) {
        const status = cause instanceof ApiClientError ? cause.status : 0;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          accepted += 0;
        } else {
          remaining.push({ ...item, lastError: cause instanceof Error ? cause.message : 'Not sent' });
        }
      }
    }
    await writeList(OBSERVATIONS_KEY, remaining);
    return { accepted, remaining: remaining.length };
  });
}

export async function readActiveShift(): Promise<LocalShift | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
  return raw ? (JSON.parse(raw) as LocalShift) : null;
}

export async function writeActiveShift(shift: LocalShift | null): Promise<void> {
  if (!shift) {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
}

export type { PresenceState };
