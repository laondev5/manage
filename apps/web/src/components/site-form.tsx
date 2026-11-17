'use client';

import { useState } from 'react';
import type { SiteDetail } from '@manage/contracts';
import { Button, Field, InlineError, Input, Select, Toggle, cn } from './ui';
import { IconPin } from './icons';

export type SiteFormValues = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  timezone: string;
  radiusMeters: string;
  exitBufferMeters: string;
  entryBufferMeters: string;
  graceSeconds: string;
  maxAccuracyMeters: string;
  freshnessSeconds: string;
  expectedStart: string;
  expectedEnd: string;
  expectedDays: number[];
  email: boolean;
  push: boolean;
  onDutyAlerts: boolean;
};

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'UTC',
];

export function siteToForm(site: SiteDetail): SiteFormValues {
  return {
    name: site.name,
    address: site.address,
    latitude: String(site.latitude),
    longitude: String(site.longitude),
    timezone: site.timezone,
    radiusMeters: String(site.policy.radiusMeters),
    exitBufferMeters: String(site.policy.exitBufferMeters),
    entryBufferMeters: String(site.policy.entryBufferMeters),
    graceSeconds: String(site.policy.graceSeconds),
    maxAccuracyMeters: String(site.policy.maxAccuracyMeters),
    freshnessSeconds: String(site.policy.freshnessSeconds),
    expectedStart: site.expectedHours?.start ?? '08:00',
    expectedEnd: site.expectedHours?.end ?? '17:00',
    expectedDays: site.expectedHours?.days ?? [1, 2, 3, 4, 5],
    email: site.notificationPreferences.email,
    push: site.notificationPreferences.push,
    onDutyAlerts: site.notificationPreferences.onDutyAlerts,
  };
}

export const EMPTY_SITE_FORM: SiteFormValues = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  timezone: 'Africa/Lagos',
  radiusMeters: '150',
  exitBufferMeters: '30',
  entryBufferMeters: '15',
  graceSeconds: '120',
  maxAccuracyMeters: '50',
  freshnessSeconds: '120',
  expectedStart: '08:00',
  expectedEnd: '17:00',
  expectedDays: [1, 2, 3, 4, 5],
  email: true,
  push: true,
  onDutyAlerts: true,
};

export function SiteForm({
  formId,
  values,
  onChange,
  onSubmit,
  mode,
  busy,
  error,
  fieldErrors = {},
}: {
  formId: string;
  values: SiteFormValues;
  onChange: (values: SiteFormValues) => void;
  onSubmit: () => void;
  mode: 'create' | 'edit';
  busy: boolean;
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const set = <K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationNote('This browser does not expose a location. Enter coordinates manually.');
      return;
    }
    setLocating(true);
    setLocationNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...values,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocationNote(`Pinned to your current position (accurate to ${Math.round(position.coords.accuracy)} m).`);
        setLocating(false);
      },
      () => {
        setLocationNote('Location permission was denied. Enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const numberError = (key: keyof SiteFormValues, message: string) =>
    fieldErrors[key]?.[0] ?? (values[key] === '' ? message : null);

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {error ? <InlineError>{error}</InlineError> : null}

      <div className="space-y-3">
        <Field label="Site name" htmlFor={`${formId}-name`} error={fieldErrors.name?.[0]}>
          <Input
            id={`${formId}-name`}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Marina Tower"
            required
          />
        </Field>
        <Field label="Address" htmlFor={`${formId}-address`} error={fieldErrors.address?.[0]}>
          <Input
            id={`${formId}-address`}
            value={values.address}
            onChange={(event) => set('address', event.target.value)}
            placeholder="12 Marina Road, Lagos"
            required
          />
        </Field>
      </div>

      <div className="rounded-xl border border-line bg-canvas p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-medium text-ink">Site centre</p>
            <p className="text-[11.5px] text-muted">Clock-ins are measured from this point.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={useCurrentLocation}
            loading={locating}
            icon={<IconPin className="h-3.5 w-3.5" />}
          >
            Use my location
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Latitude" htmlFor={`${formId}-lat`} error={numberError('latitude', 'Add a latitude.')}>
            <Input
              id={`${formId}-lat`}
              inputMode="decimal"
              value={values.latitude}
              onChange={(event) => set('latitude', event.target.value)}
              placeholder="6.455000"
            />
          </Field>
          <Field label="Longitude" htmlFor={`${formId}-lng`} error={numberError('longitude', 'Add a longitude.')}>
            <Input
              id={`${formId}-lng`}
              inputMode="decimal"
              value={values.longitude}
              onChange={(event) => set('longitude', event.target.value)}
              placeholder="3.384100"
            />
          </Field>
        </div>
        {locationNote ? <p className="mt-2 text-[11.5px] text-muted">{locationNote}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Timezone" htmlFor={`${formId}-tz`} error={fieldErrors.timezone?.[0]}>
          <Select
            id={`${formId}-tz`}
            value={values.timezone}
            onChange={(event) => set('timezone', event.target.value)}
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="On-site radius"
          htmlFor={`${formId}-radius`}
          hint="Between 50 m and 2,000 m."
          error={fieldErrors['policy.radiusMeters']?.[0]}
        >
          <div className="relative">
            <Input
              id={`${formId}-radius`}
              inputMode="numeric"
              value={values.radiusMeters}
              onChange={(event) => set('radiusMeters', event.target.value.replace(/\D/g, ''))}
              className="pr-9"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">m</span>
          </div>
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink">Expected hours</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start" htmlFor={`${formId}-hours-start`}>
            <Input
              id={`${formId}-hours-start`}
              type="time"
              value={values.expectedStart}
              onChange={(event) => set('expectedStart', event.target.value)}
            />
          </Field>
          <Field label="End" htmlFor={`${formId}-hours-end`}>
            <Input
              id={`${formId}-hours-end`}
              type="time"
              value={values.expectedEnd}
              onChange={(event) => set('expectedEnd', event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {DAYS.map((day) => {
            const active = values.expectedDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set(
                    'expectedDays',
                    active
                      ? values.expectedDays.filter((value) => value !== day.value)
                      : [...values.expectedDays, day.value],
                  )
                }
                className={cn(
                  'h-8 rounded-lg border px-2.5 text-[12px] font-medium transition-colors',
                  active
                    ? 'border-cobalt bg-[#eef3fd] text-cobalt'
                    : 'border-line bg-white text-muted hover:border-[#c6d0e2]',
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">Times use the site timezone, not the browser.</p>
      </div>

      <div className="rounded-xl border border-line">
        <button
          type="button"
          onClick={() => setAdvanced((open) => !open)}
          aria-expanded={advanced}
          className="flex w-full items-center justify-between px-3.5 py-3 text-left"
        >
          <span>
            <span className="block text-[13px] font-medium text-ink">Presence rules</span>
            <span className="block text-[11.5px] text-muted">Buffers, accuracy, and freshness defaults</span>
          </span>
          <span className="text-[12px] font-medium text-cobalt">{advanced ? 'Hide' : 'Show'}</span>
        </button>
        {advanced ? (
          <div className="grid gap-3 border-t border-line px-3.5 py-3.5 sm:grid-cols-2">
            <Field label="Exit buffer" htmlFor={`${formId}-exit`} hint="Meters past the radius before leaving.">
              <Input
                id={`${formId}-exit`}
                inputMode="numeric"
                value={values.exitBufferMeters}
                onChange={(event) => set('exitBufferMeters', event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Entry buffer" htmlFor={`${formId}-entry`} hint="Meters inside the radius to re-enter.">
              <Input
                id={`${formId}-entry`}
                inputMode="numeric"
                value={values.entryBufferMeters}
                onChange={(event) => set('entryBufferMeters', event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Grace period" htmlFor={`${formId}-grace`} hint="Seconds an exit must persist.">
              <Input
                id={`${formId}-grace`}
                inputMode="numeric"
                value={values.graceSeconds}
                onChange={(event) => set('graceSeconds', event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Max accuracy" htmlFor={`${formId}-accuracy`} hint="Readings worse than this are ignored.">
              <Input
                id={`${formId}-accuracy`}
                inputMode="numeric"
                value={values.maxAccuracyMeters}
                onChange={(event) => set('maxAccuracyMeters', event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Freshness" htmlFor={`${formId}-fresh`} hint="Seconds a reading stays usable.">
              <Input
                id={`${formId}-fresh`}
                inputMode="numeric"
                value={values.freshnessSeconds}
                onChange={(event) => set('freshnessSeconds', event.target.value.replace(/\D/g, ''))}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-line">
        <div className="border-b border-line px-3.5 py-3">
          <p className="text-[13px] font-medium text-ink">Owner notifications</p>
          <p className="text-[11.5px] text-muted">Alerts are always recorded; these control delivery.</p>
        </div>
        <div className="divide-y divide-line">
          {(
            [
              ['email', 'Email', 'Send departure alerts to the organization owner email.'],
              ['push', 'Push', 'Send to owners with the mobile app installed.'],
              ['onDutyAlerts', 'On-duty alerts', 'Include departures while the staff member is still clocked in.'],
            ] as const
          ).map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div>
                <p className="text-[13px] text-ink">{label}</p>
                <p className="text-[11.5px] text-muted">{hint}</p>
              </div>
              <Toggle
                label={label}
                checked={values[key]}
                onChange={(next) => set(key, next)}
                disabled={busy}
              />
            </div>
          ))}
        </div>
      </div>

      {mode === 'create' ? (
        <p className="text-[11.5px] leading-relaxed text-muted">
          Staff are not assigned automatically. After creating the site, invite them from the site's Team tab.
        </p>
      ) : null}
    </form>
  );
}
