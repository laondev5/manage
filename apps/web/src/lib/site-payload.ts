import type { SiteFormValues } from '@/components/site-form';

export function buildSitePayload(values: SiteFormValues, organizationId: string) {
  return {
    organizationId,
    name: values.name.trim(),
    address: values.address.trim(),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    timezone: values.timezone,
    policy: {
      radiusMeters: Number(values.radiusMeters),
      exitBufferMeters: Number(values.exitBufferMeters),
      entryBufferMeters: Number(values.entryBufferMeters),
      graceSeconds: Number(values.graceSeconds),
      maxAccuracyMeters: Number(values.maxAccuracyMeters),
      freshnessSeconds: Number(values.freshnessSeconds),
    },
    expectedHours: {
      start: values.expectedStart,
      end: values.expectedEnd,
      days: values.expectedDays.length ? values.expectedDays : [1, 2, 3, 4, 5],
    },
    notificationPreferences: {
      email: values.email,
      push: values.push,
      onDutyAlerts: values.onDutyAlerts,
    },
  };
}

export function validateSiteForm(values: SiteFormValues): string | null {
  if (values.name.trim().length < 2) return 'Give the site a name of at least two characters.';
  if (values.address.trim().length < 4) return 'Add a short address for staff.';
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
  const radius = Number(values.radiusMeters);
  if (!Number.isFinite(radius) || radius < 50 || radius > 2000) return 'The on-site radius must be 50–2,000 m.';
  return null;
}
