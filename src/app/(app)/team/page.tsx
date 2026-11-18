'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CorrectionDetail,
  CorrectionSummary,
  Page,
  RosterEntry,
  SiteSummary,
  TeamMemberDetail,
} from '../../../contracts/index';
import { RequireCapability } from '@/components/app-shell';
import { correctionBadge, presenceBadge } from '@/components/status';
import { IconCheck, IconClock, IconInfo, IconUsers, IconX } from '@/components/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  InlineNotice,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  useFlash,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

type Tab = 'staff' | 'corrections';
type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function TeamPage() {
  return (
    <RequireCapability
      capability="owner.team"
      title="Team tools are for site owners"
      message="Your account can view its own history but not the team. Ask a site owner for access."
    >
      <TeamContent />
    </RequireCapability>
  );
}

type TeamRow = {
  memberId: string;
  name: string;
  email: string;
  sites: string[];
  presence: RosterEntry['presence'];
  clockedInAt: string | null;
};

const PRESENCE_RANK: Record<RosterEntry['presence'], number> = {
  INSIDE: 4,
  EXIT_PENDING: 3,
  OUTSIDE: 2,
  UNKNOWN: 1,
  NOT_WORKING: 0,
};

function TeamContent() {
  const { request } = useAuth();
  const [tab, setTab] = useState<Tab>('staff');
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('ALL');
  const [removing, setRemoving] = useState<TeamRow | null>(null);

  const sites = useApiData<SiteSummary[]>('/api/v1/sites');
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    setRosterError(null);
    try {
      const siteList = sites.data ?? [];
      const targets = siteId === 'ALL' ? siteList : siteList.filter((site) => site.id === siteId);
      const rosters = await Promise.all(
        targets.map(async (site) => ({
          site,
          entries: await request<RosterEntry[]>(`/api/v1/sites/${site.id}/roster`),
        })),
      );
      const byMember = new Map<string, TeamRow>();
      for (const { site, entries } of rosters) {
        for (const entry of entries) {
          const existing = byMember.get(entry.memberId);
          if (!existing) {
            byMember.set(entry.memberId, {
              memberId: entry.memberId,
              name: entry.name,
              email: entry.email,
              sites: [site.name],
              presence: entry.presence,
              clockedInAt: entry.clockedInAt,
            });
          } else {
            existing.sites.push(site.name);
            if (PRESENCE_RANK[entry.presence] > PRESENCE_RANK[existing.presence]) {
              existing.presence = entry.presence;
              existing.clockedInAt = entry.clockedInAt;
            }
          }
        }
      }
      setRows(
        [...byMember.values()].sort((a, b) => {
          const rank = PRESENCE_RANK[b.presence] - PRESENCE_RANK[a.presence];
          return rank !== 0 ? rank : a.name.localeCompare(b.name);
        }),
      );
    } catch (cause) {
      setRosterError(cause);
    } finally {
      setLoadingRoster(false);
    }
  }, [request, siteId, sites.data]);

  useEffect(() => {
    if (!sites.data) return;
    void loadRoster();
  }, [loadRoster, sites.data, tick]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const needle = query.toLowerCase();
    return rows.filter(
      (row) => row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  return (
    <div>
      <PageHeader
        title="Team"
        description="Who is assigned where, and the corrections that need a decision. Staff accounts are only created through invitations."
      />
      <Tabs<Tab>
        className="mb-4 max-w-sm"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'staff', label: 'Staff', count: rows.length || undefined },
          { value: 'corrections', label: 'Corrections' },
        ]}
      />

      {tab === 'staff' ? (
        <Card>
          <CardHeader
            title="Assigned staff"
            description="A person assigned to several sites appears once, with their most current presence."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Filter by site"
                  className="w-44"
                  value={siteId}
                  onChange={(event) => setSiteId(event.target.value)}
                >
                  <option value="ALL">All sites</option>
                  {(sites.data ?? []).map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </Select>
                <SearchInput value={query} onChange={setQuery} placeholder="Search staff" className="w-48" />
              </div>
            }
          />
          {loadingRoster || sites.loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : rosterError || sites.error ? (
            <ErrorState
              message={errorMessage(rosterError ?? sites.error, 'The team could not be loaded.')}
              onRetry={() => {
                sites.reload();
                setTick((value) => value + 1);
              }}
            />
          ) : filtered.length ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Staff member</Th>
                  <Th>Assigned sites</Th>
                  <Th>Presence</Th>
                  <Th>Clocked in</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.memberId} className="hover:bg-[#fafbfe]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.name} />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink">{row.name}</p>
                          <p className="truncate text-[12px] text-muted">{row.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {row.sites.map((name) => (
                          <Badge key={name} tone="slate">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>{presenceBadge(row.presence)}</Td>
                    <Td className="tabular text-muted">
                      {row.clockedInAt ? formatDateTime(row.clockedInAt) : '—'}
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(row)}
                        icon={<IconX className="h-3.5 w-3.5" />}
                      >
                        Remove
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              icon={<IconUsers className="h-5 w-5" />}
              title={rows.length ? 'No matching staff' : 'No staff assigned'}
              description={
                rows.length
                  ? 'Try a different search term.'
                  : 'Open a site and use Invite staff to bring someone on board.'
              }
            />
          )}
        </Card>
      ) : (
        <CorrectionsPanel />
      )}
      <RemoveTeamMemberDialog
        member={removing}
        onClose={() => setRemoving(null)}
        onRemoved={() => setTick((value) => value + 1)}
      />
    </div>
  );
}

function RemoveTeamMemberDialog({
  member,
  onClose,
  onRemoved,
}: {
  member: TeamRow | null;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { request } = useAuth();
  const flash = useFlash();
  const [detail, setDetail] = useState<TeamMemberDetail | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) {
      setDetail(null);
      setReason('');
      setLoadError(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    request<TeamMemberDetail>(`/api/v1/team/${member.memberId}`)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, 'The member details could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member, request]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!member || !detail) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/team/${member.memberId}`, {
        method: 'DELETE',
        body: {
          reason: reason.trim(),
          expectedVersion: detail.member.membershipVersion,
        },
      });
      flash(`${member.name} was removed from the team. Their account and history remain.`);
      onClose();
      onRemoved();
    } catch (cause) {
      setError(errorMessage(cause, 'The member could not be removed from the team.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(member)}
      onClose={busy ? () => undefined : onClose}
      title="Remove from team"
      description={member ? `${member.name} · ${member.email}` : undefined}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            form="remove-team-member"
            loading={busy}
            disabled={!detail || busy || reason.trim().length < 5}
          >
            Remove from team
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : loadError ? (
        <InlineError>{loadError}</InlineError>
      ) : (
        <form id="remove-team-member" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <InlineNotice tone="warn">
            This revokes the membership in your organization, ends all their site assignments, and
            clears any lead or inspector roles. Their account and attendance history stay intact, and
            you can invite them again later.
          </InlineNotice>
          <Field label="Reason" htmlFor="remove-team-reason" hint="At least 5 characters. Recorded in the audit log.">
            <Input
              id="remove-team-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this person is leaving the team"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

function CorrectionsPanel() {
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [selected, setSelected] = useState<CorrectionSummary | null>(null);
  const { data, error, loading, reload } = useApiData<Page<CorrectionSummary>>(
    `/api/v1/corrections?scope=review&status=${status}&limit=100`,
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs<StatusFilter>
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
        <p className="text-[12px] text-muted">
          Corrections never overwrite the attendance event — they append an approved change.
        </p>
      </div>

      <Card>
        {loading && !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error, 'Corrections could not be loaded.')} onRetry={reload} />
        ) : data?.items.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Staff member</Th>
                <Th>Site</Th>
                <Th>Original</Th>
                <Th>Proposed</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-[#fafbfe]">
                  <Td className="font-medium">{item.workerName}</Td>
                  <Td>{item.siteName}</Td>
                  <Td className="text-muted tabular">{formatRange(item.originalStartAt, item.originalEndAt)}</Td>
                  <Td className="tabular">{formatRange(item.proposedStartAt, item.proposedEndAt)}</Td>
                  <Td className="text-muted">{relativeTime(item.requestedAt)}</Td>
                  <Td>{correctionBadge(item.status)}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(item)}>
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<IconClock className="h-5 w-5" />}
            title={status === 'PENDING' ? 'No corrections waiting' : 'Nothing in this state'}
            description={
              status === 'PENDING'
                ? 'Staff can request a time correction from the mobile app. Requests appear here for an owner decision.'
                : 'Switch tabs to see other corrections.'
            }
          />
        )}
      </Card>

      <CorrectionDetailDialog
        correction={selected}
        onClose={() => setSelected(null)}
        onDecided={() => {
          setSelected(null);
          reload();
        }}
      />
    </>
  );
}

function formatRange(start: string, end: string | null) {
  return `${formatDateTime(start)} → ${end ? formatDateTime(end) : 'open'}`;
}

function CorrectionDetailDialog({
  correction,
  onClose,
  onDecided,
}: {
  correction: CorrectionSummary | null;
  onClose: () => void;
  onDecided: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [detail, setDetail] = useState<CorrectionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!correction) {
      setDetail(null);
      setNote('');
      setError(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    request<CorrectionDetail>(`/api/v1/corrections/${correction.id}`)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, 'The correction details could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [correction, request]);

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!detail) return;
    setBusy(decision);
    setError(null);
    try {
      await request(`/api/v1/corrections/${detail.id}/decision`, {
        method: 'POST',
        body: {
          decision,
          ...(note.trim() ? { note: note.trim() } : {}),
          expectedVersion: detail.version,
        },
      });
      flash(decision === 'APPROVE' ? 'Correction approved.' : 'Correction rejected.');
      onDecided();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          'The decision was not saved. If another owner already decided, close and reopen the request.',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const pending = detail?.status === 'PENDING';
  const selfRequest = detail ? detail.workerId === me?.user.id : false;

  return (
    <Modal
      open={Boolean(correction)}
      onClose={busy ? () => undefined : onClose}
      title="Time correction"
      description={detail ? `${detail.workerName} · ${detail.siteName}` : undefined}
      width="max-w-2xl"
      footer={
        pending ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={Boolean(busy)}
            >
              Close
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'REJECT'}
              disabled={Boolean(busy) || !detail}
              onClick={() => void decide('REJECT')}
              icon={<IconX className="h-3.5 w-3.5" />}
            >
              Reject
            </Button>
            <Button
              size="sm"
              loading={busy === 'APPROVE'}
              disabled={Boolean(busy) || !detail}
              onClick={() => void decide('APPROVE')}
              icon={<IconCheck className="h-3.5 w-3.5" />}
            >
              Approve
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <InlineError>{loadError}</InlineError>
      ) : detail ? (
        <div className="space-y-4">
          {error ? <InlineError>{error}</InlineError> : null}
          <div className="flex items-center gap-2">
            {correctionBadge(detail.status)}
            <span className="text-[12px] text-muted">
              Requested {formatDateTime(detail.requestedAt)} by {detail.workerName}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-[#fafbfe] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recorded</p>
              <p className="mt-1.5 text-[13px] text-ink">{formatDateTime(detail.originalStartAt)}</p>
              <p className="text-[13px] text-muted">to {detail.originalEndAt ? formatDateTime(detail.originalEndAt) : 'open'}</p>
            </div>
            <div className="rounded-lg border border-cobalt/30 bg-[#f4f7fe] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cobalt">Proposed</p>
              <p className="mt-1.5 text-[13px] font-medium text-ink">{formatDateTime(detail.proposedStartAt)}</p>
              <p className="text-[13px] text-muted">to {detail.proposedEndAt ? formatDateTime(detail.proposedEndAt) : 'open'}</p>
            </div>
          </div>

          <div>
            <p className="text-[11.5px] font-medium text-muted">Why</p>
            <p className="mt-1 rounded-lg bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink">
              {detail.reason}
            </p>
          </div>

          {detail.reviewerName ? (
            <div className="rounded-lg border border-line px-3 py-2.5 text-[12.5px]">
              <span className="text-muted">Decided by </span>
              <span className="font-medium text-ink">{detail.reviewerName}</span>
              {detail.reviewedAt ? <span className="text-muted"> · {formatDateTime(detail.reviewedAt)}</span> : null}
              {detail.reviewerNote ? <p className="mt-1 text-muted">{detail.reviewerNote}</p> : null}
            </div>
          ) : null}

          {detail.auditTrail.length ? (
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium text-muted">Audit trail</p>
              <ul className="space-y-1.5">
                {detail.auditTrail.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex items-start gap-2 text-[12.5px]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b4bdcc]" />
                    <span className="text-ink">{entry.action}</span>
                    <span className="text-muted">
                      {entry.actorName ?? 'System'} · {formatDateTime(entry.at)}
                      {entry.detail ? ` · ${entry.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pending ? (
            <div className="rounded-xl border border-line p-3.5">
              <Field
                label="Decision note"
                htmlFor="correction-note"
                optional
                hint="The staff member sees this in the mobile app."
              >
                <Textarea
                  id="correction-note"
                  value={note}
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Approved: supervisor confirmed the late start."
                />
              </Field>
              <div className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
                <IconInfo className="mt-px h-3.5 w-3.5 shrink-0" />
                {selfRequest
                  ? 'You cannot decide a correction you requested yourself.'
                  : 'Approving appends an amendment and keeps the original clock event. You cannot approve your own request, and deciding uses the version you loaded here.'}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
