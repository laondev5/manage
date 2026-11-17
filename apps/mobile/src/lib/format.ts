export function formatClock(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined, timezone?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

export function humanDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return `${hours}h ${rest.toString().padStart(2, '0')}m`;
}

export function elapsedLabel(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return humanDuration(minutes);
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function todayInput(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function daysAgoInput(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function toIsoRangeStart(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00`).toISOString();
}

export function toIsoRangeEnd(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}

/** Formats an ISO timestamp as a local `YYYY-MM-DD HH:MM` value for text inputs. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/** Parses `YYYY-MM-DD HH:MM` in the device timezone. Returns null when the text is not a valid date. */
export function fromLocalInput(value: string): string | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date.toISOString();
}
