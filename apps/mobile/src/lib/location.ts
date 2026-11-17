import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationReading } from '@manage/contracts';
import { readActiveShift, bufferObservation, flushObservations } from './queue';

export const LOCATION_TASK = 'manage-site-presence';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const shift = await readActiveShift();
  if (!shift?.shiftId) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  const latest = locations.at(-1);
  if (!latest) return;
  await bufferObservation({
    shiftId: shift.shiftId,
    siteId: shift.siteId,
    capturedAt: new Date(latest.timestamp).toISOString(),
    reading: {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracyMeters: Math.max(0, latest.coords.accuracy ?? 500),
      capturedAt: new Date(latest.timestamp).toISOString(),
    },
  });
});

export type PermissionOutcome = 'granted' | 'denied' | 'foreground-only';

/** Reads permission state without prompting. */
export async function permissionStatus(): Promise<PermissionOutcome | 'undetermined'> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return foreground.canAskAgain ? 'undetermined' : 'denied';
  }
  const background = await Location.getBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'granted' : 'foreground-only';
}

export async function requestLocationPermissions(): Promise<PermissionOutcome> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return 'denied';
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'granted' : 'foreground-only';
}

export async function currentReading(): Promise<LocationReading | null> {
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: Math.max(0, position.coords.accuracy ?? 500),
      capturedAt: new Date(position.timestamp).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function startTracking(): Promise<{ tracking: boolean; background: boolean }> {
  const permission = await Location.getBackgroundPermissionsAsync();
  const background = permission.status === 'granted';
  const running = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (running) return { tracking: true, background };
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 40,
      deferredUpdatesInterval: 60_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      foregroundService: background
        ? {
            notificationTitle: 'Manage is confirming your site presence',
            notificationBody: 'Location checks run only while you are clocked in. Tap to open Manage.',
            notificationColor: '#2457D6',
          }
        : undefined,
    });
    return { tracking: true, background };
  } catch {
    return { tracking: false, background };
  }
}

export async function stopTracking(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Already stopped.
  }
}

export async function isTracking(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function flushLocationData(): Promise<{ accepted: number; remaining: number }> {
  return flushObservations();
}
