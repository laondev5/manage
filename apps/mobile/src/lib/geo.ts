import type { LocationReading } from '@manage/contracts';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in metres, for display only. The API computes the authoritative distance. */
export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)));
}

export function distanceLabel(
  reading: LocationReading,
  site: { latitude: number; longitude: number },
): string {
  const meters = distanceMeters(reading, site);
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export function isAccurate(reading: LocationReading, maxAccuracyMeters: number): boolean {
  return reading.accuracyMeters <= maxAccuracyMeters;
}
