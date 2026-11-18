'use client';

import { useParams } from 'next/navigation';import { useEffect, useState } from 'react';
import type { InvitationSummary, RosterEntry, SiteDetail } from '../../../../contracts/index';
import { buildSitePayload, validateSiteForm } from '@/lib/site-payload';
import { SiteForm, siteToForm, type SiteFormValues } from '@/components/site-form';
import { invitationBadge, presenceBadge } from '@/components/status';
import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconClock,
  IconMail,
  IconPin,
  IconPlus,
  IconRefresh,
  IconUsers,
  IconX,
} from '@/components/icons';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  InlineNotice,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SectionLabel,
  Skeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  useFlash,
} from '@/components/ui';
import { errorMessage, fieldErrors } from '@/lib/api';
import { hasCapability, useAuth } from '@/lib/auth';
import { expectedHoursLabel, formatDateTime, relativeTime } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

type Tab = 'roster' | 'invitations' | 'settings';

export default function SiteDetailPage() {
  const params = useParams<{ siteId: string }>();
  const siteId = typeof params.siteId === 'string' ? params.siteId : '';
  const { me } = useAuth();
  const [tab, setTab] = useState<Tab>('roster');
  const [inviteOpen, setInviteOpen] = useState(false);

  const site = useApiData<SiteDetail>(siteId ? `/api/v1/sites/${siteId}` : null);
  const roster = useApiData<RosterEntry[]>(siteId ? `/api/v1/sites/${siteId}/roster` : null);
  const invitations = useApiData<InvitationSummary[]>(
    siteId ? `/api/v1/sites/${siteId}/invitations` : null,
  );

  const reloadAll = () => {
    site.reload();
    roster.reload();
    invitations.reload();
  };

  if (site.loading && !site.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (site.error || !site.data) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: 'Sites', href: '/sites' }, { label: 'Site' }]} />
        <ErrorState
          title="This site could not be opened"
          message={errorMessage(site.error, 'The site may have been removed, or you no longer own it.')}
          onRetry={site.reload}
        />
      </div>
    );
  }

  const data = site.data;
  const rosterItems = roster.data ?? [];
  const onSiteCount = rosterItems.filter(
    (entry) => entry.presence === 'INSIDE' || entry.presence === 'EXIT_PENDING',
  ).length;
  const pendingInvites = (invitations.data ?? []).filter((entry) => entry.status === 'PENDING');

  return (
    <div>
      <div className="mb-2">
        <Breadcrumb items={[{ label: 'Sites', href: '/sites' }, { label: data.name }]} />
      </div>
      <PageHeader
        title={data.name}
        description={data.address}
        actions={
          <>
            <Button variant="secondary" onClick={reloadAll} icon={<IconRefresh className="h-4 w-4" />}>
              Refresh
            </Button>
            {hasCapability(me, 'owner.team') ? (
              <Button onClick={() => setInviteOpen(true)} icon={<IconPlus className="h-4 w-4" />}>
                Invite staff
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <SectionLabel>On site now</SectionLabel>
          <p className="mt-2 text-[26px] font-semibold tabular text-ink">{onSiteCount}</p>
          <p className="mt-1 text-[12px] text-muted">of {rosterItems.length} assigned</p>
        </Card>
        <Card className="p-4">
          <SectionLabel>Presence radius</SectionLabel>
          <p className="mt-2 text-[26px] font-semibold tabular text-ink">{data.radiusMeters} m</p>
          <p className="mt-1 text-[12px] text-muted">
            +{data.policy.exitBufferMeters} m exit buffer · policy v{data.policyVersion}
          </p>
        </Card>
        <Card className="p-4">
          <SectionLabel>Pending invitations</SectionLabel>
          <p className="mt-2 text-[26px] font-semibold tabular text-ink">{pendingInvites.length}</p>
          <p className="mt-1 text-[12px] text-muted">
            {data.status === 'ACTIVE' ? 'Site accepts clock-ins' : 'Inactive site blocks clock-ins'}
          </p>
        </Card>
      </div>

      <Tabs<Tab>
        className="mb-4 max-w-md"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'roster', label: 'Roster', count: rosterItems.length },
          { value: 'invitations', label: 'Invitations', count: pendingInvites.length },
          { value: 'settings', label: 'Settings' },
        ]}
      />

      {tab === 'roster' ? (
        <RosterPanel
          siteId={siteId}
          entries={rosterItems}
          loading={roster.loading}
          error={roster.error}
          onRetry={roster.reload}
          onRemoved={roster.reload}
          onInvite={() => setInviteOpen(true)}
          canInvite={hasCapability(me, 'owner.team')}
          canManage={hasCapability(me, 'owner.team')}
        />
      ) : null}

      {tab === 'invitations' ? (
        <InvitationsPanel
          siteId={siteId}
          entries={invitations.data ?? []}
          loading={invitations.loading}
          error={invitations.error}
          onRetry={invitations.reload}
          onInvite={() => setInviteOpen(true)}
          canInvite={hasCapability(me, 'owner.team')}
        />
      ) : null}

      {tab === 'settings' ? (
        <SettingsPanel site={data} canEdit={hasCapability(me, 'owner.sites')} onSaved={reloadAll} />
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <ButtonLink href="/sites" variant="ghost" size="sm" icon={<IconArrowLeft className="h-4 w-4" />}>
          All sites
        </ButtonLink>
      </div>

      {hasCapability(me, 'owner.team') ? (
        <InviteDialog
          open={inviteOpen}
          siteId={siteId}
          siteName={data.name}
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            invitations.reload();
            roster.reload();
            site.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function RosterPanel({
  siteId,
  entries,
  loading,
  error,
  onRetry,
  onRemoved,
  onInvite,
  canInvite,
  canManage,
}: {
  siteId: string;
  entries: RosterEntry[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onRemoved: () => void;
  onInvite: () => void;
  canInvite: boolean;
  canManage: boolean;
}) {
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<RosterEntry | null>(null);
  const filtered = entries.filter((entry) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return entry.name.toLowerCase().includes(needle) || entry.email.toLowerCase().includes(needle);
  });

  return (
    <Card>
      <CardHeader
        title="Assigned staff"
        description="Presence reflects the latest qualified reading, not just the clock-in."
        action={
          entries.length ? (
            <SearchInput value={query} onChange={setQuery} placeholder="Search staff" className="w-56" />
          ) : null
        }
      />
      {loading && !entries.length ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error, 'The roster could not be loaded.')} onRetry={onRetry} />
      ) : filtered.length ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>Staff member</Th>
              <Th>Role</Th>
              <Th>Presence</Th>
              <Th>Clocked in</Th>
              <Th>Last location</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.memberId} className="hover:bg-[#fafbfe]">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={entry.name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{entry.name}</p>
                      <p className="truncate text-[12px] text-muted">{entry.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={entry.role === 'SITE_OWNER' ? 'navy' : 'slate'}>
                    {entry.role === 'SITE_OWNER' ? 'Owner' : entry.role === 'PLATFORM_ADMIN' ? 'Admin' : 'Staff'}
                  </Badge>
                </Td>
                <Td>{presenceBadge(entry.presence)}</Td>
                <Td className="tabular">{entry.clockedInAt ? formatDateTime(entry.clockedInAt) : '—'}</Td>
                <Td className="text-muted">{entry.lastUpdateAt ? relativeTime(entry.lastUpdateAt) : '—'}</Td>
                <Td className="text-right">
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(entry)}
                      icon={<IconX className="h-3.5 w-3.5" />}
                    >
                      Remove
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState
          icon={<IconUsers className="h-5 w-5" />}
          title={entries.length ? 'No matching staff' : 'No staff assigned yet'}
          description={
            entries.length
              ? 'Try a different name or email.'
              : 'Invite a staff member to this site. They create an account from the invitation email, then clock in from the mobile app.'
          }
          action={
            !entries.length && canInvite ? (
              <Button size="sm" onClick={onInvite} icon={<IconPlus className="h-4 w-4" />}>
                Invite staff
              </Button>
            ) : null
          }
        />
      )}
      <RemoveSiteMemberDialog
        siteId={siteId}
        entry={removing}
        onClose={() => setRemoving(null)}
        onRemoved={onRemoved}
      />
    </Card>
  );
}

function RemoveSiteMemberDialog({
  siteId,
  entry,
  onClose,
  onRemoved,
}: {
  siteId: string;
  entry: RosterEntry | null;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { request } = useAuth();
  const flash = useFlash();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setReason('');
      setError(null);
    }
  }, [entry]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/sites/${siteId}/assignments/${entry.assignmentId}`, {
        method: 'DELETE',
        body: { reason: reason.trim() },
      });
      flash(`${entry.name} was removed from this site. Their account and history remain.`);
      onClose();
      onRemoved();
    } catch (cause) {
      setError(errorMessage(cause, 'The member could not be removed from this site.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(entry)}
      onClose={busy ? () => undefined : onClose}
      title="Remove from this site"
      description={entry ? `${entry.name} · ${entry.email}` : undefined}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            form="remove-site-member"
            loading={busy}
            disabled={reason.trim().length < 5}
          >
            Remove from site
          </Button>
        </>
      }
    >
      <form id="remove-site-member" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineError>{error}</InlineError> : null}
        <InlineNotice tone="warn">
          This ends their assignment here and clears any site lead or inspector role. Their organization
          membership and attendance history stay intact.
        </InlineNotice>
        <Field label="Reason" htmlFor="remove-site-reason" hint="At least 5 characters. Recorded in the audit log.">
          <Input
            id="remove-site-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this member no longer works at this site"
          />
        </Field>
      </form>
    </Modal>
  );
}

function InvitationsPanel({
  siteId,
  entries,
  loading,
  error,
  onRetry,
  onInvite,
  canInvite,
}: {
  siteId: string;
  entries: InvitationSummary[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onInvite: () => void;
  canInvite: boolean;
}) {
  const { request } = useAuth();
  const flash = useFlash();
  const [revoking, setRevoking] = useState<InvitationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setRevokeError(null);
    try {
      await request(`/api/v1/sites/${siteId}/invitations/${revoking.id}`, { method: 'DELETE' });
      flash('Invitation revoked.');
      setRevoking(null);
      onRetry();
    } catch (cause) {
      setRevokeError(errorMessage(cause, 'The invitation could not be revoked.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Invitations"
        description="Invitation-only enrollment. Links are single-use and expire after seven days."
        action={
          canInvite ? (
            <Button size="sm" variant="secondary" onClick={onInvite} icon={<IconPlus className="h-3.5 w-3.5" />}>
              Invite
            </Button>
          ) : null
        }
      />
      {loading && !entries.length ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error, 'Invitations could not be loaded.')} onRetry={onRetry} />
      ) : entries.length ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Sent</Th>
              <Th>Expires</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-[#fafbfe]">
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <IconMail className="h-3.5 w-3.5 text-muted" />
                    {entry.email}
                  </span>
                </Td>
                <Td>{invitationBadge(entry.status)}</Td>
                <Td className="text-muted">{formatDateTime(entry.createdAt)}</Td>
                <Td className="text-muted">{formatDateTime(entry.expiresAt)}</Td>
                <Td className="text-right">
                  {entry.status === 'PENDING' && canInvite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRevokeError(null);
                        setRevoking(entry);
                      }}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState
          icon={<IconMail className="h-5 w-5" />}
          title="No invitations yet"
          description="Invite the staff who work at this site. They will confirm their email before their account opens."
          action={
            canInvite ? (
              <Button size="sm" onClick={onInvite} icon={<IconPlus className="h-4 w-4" />}>
                Invite staff
              </Button>
            ) : null
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke this invitation?"
        description={revoking ? `${revoking.email} will not be able to use their link.` : undefined}
        confirmLabel="Revoke invitation"
        tone="danger"
        busy={busy}
      >
        {revokeError ? <InlineError>{revokeError}</InlineError> : null}
        <p className="text-[13px] leading-relaxed text-muted">
          You can send a fresh invitation afterwards. Revoking does not affect an account that already exists.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

function SettingsPanel({
  site,
  canEdit,
  onSaved,
}: {
  site: SiteDetail;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { request } = useAuth();
  const flash = useFlash();
  const [values, setValues] = useState<SiteFormValues>(() => siteToForm(site));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const save = async () => {
    const invalid = validateSiteForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    setFields({});
    try {
      const payload = buildSitePayload(values, site.organizationId);
      await request(`/api/v1/sites/${site.id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
          timezone: payload.timezone,
          policy: payload.policy,
          expectedHours: payload.expectedHours,
          notificationPreferences: payload.notificationPreferences,
          version: site.version,
        },
      });
      flash('Site settings saved.');
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          'The settings could not be saved. If the site changed in another tab, refresh and try again.',
        ),
      );
      setFields(fieldErrors(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader
          title="Site settings"
          description="Saving creates a new policy version. Existing clock-ins keep the version they were captured with."
        />
        <div className="p-5">
          {!canEdit ? (
            <InlineNotice tone="warn">Your role can view this site but not change its settings.</InlineNotice>
          ) : null}
          <div className={canEdit ? '' : 'pointer-events-none opacity-60'}>
            <SiteForm
              formId="site-settings-form"
              mode="edit"
              values={values}
              onChange={(next) => {
                setValues(next);
                setSaved(false);
              }}
              onSubmit={save}
              busy={busy}
              error={error}
              fieldErrors={fields}
            />
          </div>
          {canEdit ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button form="site-settings-form" type="submit" loading={busy}>
                Save settings
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setValues(siteToForm(site));
                  setError(null);
                  setFields({});
                }}
                disabled={busy}
              >
                Discard changes
              </Button>
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-cobalt">
                  <IconCheck className="h-4 w-4" /> Saved · version {site.version + 1}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Location" />
          <div className="space-y-3 p-5 text-[13px]">
            <Row icon={<IconPin className="h-4 w-4" />} label="Centre">
              {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
            </Row>
            <Row icon={<IconBuilding className="h-4 w-4" />} label="Timezone">
              {site.timezone}
            </Row>
            <Row icon={<IconClock className="h-4 w-4" />} label="Expected hours">
              {expectedHoursLabel(site.expectedHours)}
            </Row>
            <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
              The site address and coordinates pin clock-in checks. Movement outside the radius (plus exit
              buffer) for the grace period raises a departure alert.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Policy version" description={`Version ${site.policyVersion}`} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-5 text-[12.5px]">
            {[
              ['Radius', `${site.policy.radiusMeters} m`],
              ['Exit buffer', `${site.policy.exitBufferMeters} m`],
              ['Entry buffer', `${site.policy.entryBufferMeters} m`],
              ['Grace', `${site.policy.graceSeconds} s`],
              ['Max accuracy', `${site.policy.maxAccuracyMeters} m`],
              ['Freshness', `${site.policy.freshnessSeconds} s`],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-muted">{term}</dt>
                <dd className="mt-0.5 font-medium tabular text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11.5px] text-muted">{label}</p>
        <p className="text-[13px] text-ink">{children}</p>
      </div>
    </div>
  );
}

function InviteDialog({
  open,
  siteId,
  siteName,
  onClose,
  onInvited,
}: {
  open: boolean;
  siteId: string;
  siteName: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { request } = useAuth();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; token: string | null } | null>(null);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await request<{
        invitation: { email: string };
        developmentToken: string | null;
      }>(`/api/v1/sites/${siteId}/invitations`, {
        method: 'POST',
        body: { email: email.trim(), ...(note.trim() ? { note: note.trim() } : {}) },
      });
      setResult({ email: response.invitation.email, token: response.developmentToken });
      onInvited();
    } catch (cause) {
      setError(errorMessage(cause, 'The invitation could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setEmail('');
    setNote('');
    setError(null);
    setResult(null);
    onClose();
  };

  const inviteUrl =
    result?.token && typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${result.token}`
      : null;

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : reset}
      title={result ? 'Invitation created' : `Invite staff to ${siteName}`}
      description={
        result
          ? 'In production the invitation is emailed. Development builds also return a link you can open directly.'
          : 'They will join your organization as staff and be assigned only to this site.'
      }
      footer={
        result ? (
          <>
            <Button variant="secondary" size="sm" onClick={reset}>
              Done
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setResult(null);
                setEmail('');
                setNote('');
              }}
            >
              Invite someone else
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form="invite-form" loading={busy}>
              Send invitation
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <InlineNotice tone="success">
            {inviteUrl
              ? `Invitation for ${result.email} is ready. Share the link below or open it yourself to test the flow.`
              : `Invitation email sent to ${result.email}. It expires in seven days.`}
          </InlineNotice>
          {inviteUrl ? (
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-ink">Development invitation link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all overflow-x-auto rounded-lg bg-canvas px-3 py-2 font-mono text-[12px] text-ink">
                  {inviteUrl}
                </code>
                <CopyButton value={inviteUrl} />
              </div>
              <p className="text-[11.5px] text-muted">
                This link is only returned outside production. Treat it like a password.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <form id="invite-form" onSubmit={invite} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <Field
            label="Work email"
            htmlFor="invite-email"
            hint="The invitation and verification links go to this address."
          >
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="new.staff@company.com"
            />
          </Field>
          <Field label="Note to include" htmlFor="invite-note" optional>
            <Textarea
              id="invite-note"
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Shift starts Monday at 8, ask for the site supervisor."
            />
          </Field>
          <div className="rounded-lg bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            Invitations are single-use. The recipient cannot create an account another way, and they cannot
            choose their own role.
          </div>
        </form>
      )}
    </Modal>
  );
}
