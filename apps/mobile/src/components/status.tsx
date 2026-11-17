import { Badge } from './ui';

export function reviewBadge(state: 'ACCEPTED' | 'NEEDS_REVIEW' | 'REJECTED') {
  if (state === 'ACCEPTED') return <Badge tone="blue">Accepted</Badge>;
  if (state === 'NEEDS_REVIEW') return <Badge tone="amber">Needs review</Badge>;
  return <Badge tone="red">Rejected</Badge>;
}

const PRESENCE: Record<string, { label: string; tone: 'blue' | 'amber' | 'red' | 'slate' }> = {
  INSIDE: { label: 'On site', tone: 'blue' },
  EXIT_PENDING: { label: 'Leaving · grace', tone: 'amber' },
  OUTSIDE: { label: 'Outside', tone: 'red' },
  UNKNOWN: { label: 'Uncertain', tone: 'slate' },
  NOT_WORKING: { label: 'Not working', tone: 'slate' },
};

export function presenceBadge(state: string) {
  const entry = PRESENCE[state] ?? { label: state, tone: 'slate' as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function alertStateBadge(state: 'UNREAD' | 'READ' | 'REVIEWED') {
  if (state === 'UNREAD') return <Badge tone="amber">Unread</Badge>;
  if (state === 'READ') return <Badge tone="blue">Read</Badge>;
  return <Badge tone="slate">Reviewed</Badge>;
}

export function correctionBadge(state: 'PENDING' | 'APPROVED' | 'REJECTED') {
  if (state === 'PENDING') return <Badge tone="amber">Pending</Badge>;
  if (state === 'APPROVED') return <Badge tone="blue">Approved</Badge>;
  return <Badge tone="red">Rejected</Badge>;
}
