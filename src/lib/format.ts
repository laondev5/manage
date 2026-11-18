const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatClock(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

export function formatDate(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(value));
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  return `${Math.round(diff / DAY)} d ago`;
}

export function humanDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest} min`;
  return `${hours} h ${rest.toString().padStart(2, '0')} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function roleLabel(role: string): string {
  if (role === 'PLATFORM_ADMIN') return 'Platform admin';
  if (role === 'SITE_OWNER') return 'Site owner';
  return 'Staff';
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function expectedHoursLabel(hours: { start: string; end: string; days: number[] } | null): string {
  if (!hours) return 'No schedule set';
  const days = hours.days.length === 7 ? 'Every day' : hours.days.map((day) => DAY_LABELS[day] ?? '').join(', ');
  return `${days} · ${hours.start}–${hours.end}`;
}

export function localDateInput(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * MINUTE).toISOString().slice(0, 10);
}

export function daysAgoInput(days: number): string {
  return localDateInput(new Date(Date.now() - days * DAY));
}

export function toIsoRangeStart(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00`).toISOString();
}

export function toIsoRangeEnd(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}
