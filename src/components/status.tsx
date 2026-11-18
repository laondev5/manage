import { Badge, type BadgeTone } from './ui';

export function reviewBadge(state: 'ACCEPTED' | 'NEEDS_REVIEW' | 'REJECTED') {
  if (state === 'ACCEPTED') return <Badge tone="blue">Accepted</Badge>;
  if (state === 'NEEDS_REVIEW') return <Badge tone="amber">Needs review</Badge>;
  return <Badge tone="red">Rejected</Badge>;
}

const PRESENCE: Record<string, { label: string; tone: BadgeTone }> = {
  INSIDE: { label: 'On site', tone: 'blue' },
  EXIT_PENDING: { label: 'Leaving · grace', tone: 'amber' },
  OUTSIDE: { label: 'Outside', tone: 'red' },
  UNKNOWN: { label: 'Uncertain', tone: 'slate' },
  NOT_WORKING: { label: 'Not working', tone: 'slate' },
};

export function presenceBadge(state: string) {
  const entry = PRESENCE[state] ?? { label: state, tone: 'slate' as BadgeTone };
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
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

export function membershipBadge(state: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') {
  if (state === 'ACTIVE') return <Badge tone="blue">Active</Badge>;
  if (state === 'SUSPENDED') return <Badge tone="amber">Suspended</Badge>;
  return <Badge tone="red">Revoked</Badge>;
}

export function organizationBadge(state: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') {
  if (state === 'ACTIVE') return <Badge tone="blue">Active</Badge>;
  if (state === 'SUSPENDED') return <Badge tone="amber">Suspended</Badge>;
  return <Badge tone="slate">Archived</Badge>;
}

export function invitationBadge(state: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED') {
  if (state === 'PENDING') return <Badge tone="amber">Pending</Badge>;
  if (state === 'ACCEPTED') return <Badge tone="blue">Accepted</Badge>;
  if (state === 'EXPIRED') return <Badge tone="slate">Expired</Badge>;
  return <Badge tone="red">Revoked</Badge>;
}

export function deliveryBadge(state: string) {
  if (state === 'SENT') return <Badge tone="blue">Sent</Badge>;
  if (state === 'PENDING') return <Badge tone="slate">Pending</Badge>;
  if (state === 'LEASED') return <Badge tone="slate">Leased</Badge>;
  if (state === 'FAILED') return <Badge tone="amber">Failed</Badge>;
  if (state === 'DEAD') return <Badge tone="red">Dead</Badge>;
  return <Badge tone="slate">{state}</Badge>;
}
