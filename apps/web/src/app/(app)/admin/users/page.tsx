'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminUserSummary, OrganizationSummary, PlatformSiteSummary } from '@manage/contracts';
import { RequireAdmin } from '@/components/app-shell';
import { membershipBadge } from '@/components/status';
import { IconMail, IconPlus, IconShield } from '@/components/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
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
import { ReauthDialog, isRecentAuthError } from '@/components/reauth';
import { errorMessage, fieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, roleLabel } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

type Tab = 'users' | 'grants';

type Grant = {
  id: string;
  adminUserId: string;
  adminName: string;
  organizationId: string;
  organizationName: string;
  siteId: string | null;
  siteName: string | null;
  capability: string;
  expiresAt: string;
  createdAt: string;
};

export default function AdminUsersPage() {
  return (
    <RequireAdmin>
      <UsersContent />
    </RequireAdmin>
  );
}

function UsersContent() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <div>
      <PageHeader
        title="Users & access"
        description="Accounts across the platform, their MFA state, and any time-boxed operational grants."
      />
      <Tabs<Tab>
        className="mb-4 max-w-sm"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'users', label: 'Users' },
          { value: 'grants', label: 'Access grants' },
        ]}
      />
      {tab === 'users' ? <UsersPanel /> : <GrantsPanel />}
    </div>
  );
}

function UsersPanel() {
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useApiData<AdminUserSummary[]>('/api/v1/admin/users');

  const filtered = (data ?? []).filter((user) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
  });

  return (
    <Card>
      <CardHeader
        title="Accounts"
        description="MFA is mandatory for owners and admins; the server blocks their workspace until it is enrolled."
        action={<SearchInput value={query} onChange={setQuery} placeholder="Search users" className="w-56" />}
      />
      {loading && !data ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error, 'Users could not be loaded.')} onRetry={reload} />
      ) : filtered.length ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Security</Th>
              <Th>Memberships</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-[#fafbfe]">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{user.name}</p>
                      <p className="truncate text-[12px] text-muted">{user.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={user.emailVerified ? 'blue' : 'amber'}>
                      {user.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                    <Badge tone={user.twoFactorEnabled ? 'blue' : 'slate'}>
                      {user.twoFactorEnabled ? 'MFA' : 'No MFA'}
                    </Badge>
                  </div>
                </Td>
                <Td>
                  {user.memberships.length ? (
                    <div className="flex flex-col gap-1">
                      {user.memberships.map((membership) => (
                        <span key={`${membership.organizationId}-${membership.role}`} className="inline-flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/admin/organizations/${membership.organizationId}`}
                            className="text-[12.5px] text-ink hover:text-cobalt hover:underline"
                          >
                            {membership.organizationName}
                          </Link>
                          <span className="text-[11.5px] text-muted">{roleLabel(membership.role)}</span>
                          {membership.status !== 'ACTIVE' ? membershipBadge(membership.status) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted">No membership</span>
                  )}
                </Td>
                <Td className="text-muted">{formatDate(user.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState
          icon={<IconMail className="h-5 w-5" />}
          title={query ? 'No matching users' : 'No users yet'}
          description="Accounts are created only through staff invitations or seeded administrators."
        />
      )}
    </Card>
  );
}

const CAPABILITIES = [
  { value: 'admin.attendance_read', label: 'Read attendance (timesheets)' },
  { value: 'admin.location_read', label: 'Read location evidence' },
  { value: 'admin.corrections_support', label: 'Support correction decisions' },
  { value: 'admin.exports', label: 'Export attendance CSV' },
];

function GrantsPanel() {
  const { request, me } = useAuth();
  const flash = useFlash();
  const { data, error, loading, reload } = useApiData<Grant[]>('/api/v1/admin/grants');
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [retryRevoke, setRetryRevoke] = useState(false);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setRevokeError(null);
    try {
      await request(`/api/v1/admin/grants/${revoking.id}`, { method: 'DELETE' });
      flash('Grant revoked.');
      setRevoking(null);
      reload();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setRetryRevoke(true);
        setReauth(true);
      } else {
        setRevokeError(errorMessage(cause, 'The grant could not be revoked.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Access grants"
          description="Grants are scoped to one admin, one organization, and optionally one site. They expire within 30 days."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} icon={<IconPlus className="h-3.5 w-3.5" />}>
              New grant
            </Button>
          }
        />
        {loading && !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error, 'Grants could not be loaded.')} onRetry={reload} />
        ) : data?.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Administrator</Th>
                <Th>Scope</Th>
                <Th>Capability</Th>
                <Th>Expires</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.map((grant) => (
                <tr key={grant.id} className="hover:bg-[#fafbfe]">
                  <Td className="font-medium">{grant.adminName}</Td>
                  <Td>
                    <span className="text-ink">{grant.organizationName}</span>
                    <span className="block text-[11.5px] text-muted">
                      {grant.siteName ?? 'All sites'}
                    </span>
                  </Td>
                  <Td>
                    <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11.5px]">
                      {grant.capability}
                    </code>
                  </Td>
                  <Td className="text-muted tabular">{formatDateTime(grant.expiresAt)}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRevokeError(null);
                        setRevoking(grant);
                      }}
                    >
                      Revoke
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<IconShield className="h-5 w-5" />}
            title="No operational grants"
            description="Administrators see aggregate counts by default. Grant scoped access only for a specific support task, with a reason."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)} icon={<IconPlus className="h-4 w-4" />}>
                New grant
              </Button>
            }
          />
        )}
        <div className="border-t border-line px-5 py-3">
          <InlineNotice>
            Grant and revoke actions are recorded in the audit log with the reason you provide. Never leave a
            standing grant in place after the task is done.
          </InlineNotice>
        </div>
      </Card>

      <CreateGrantDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} />

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke this grant?"
        description={
          revoking
            ? `${revoking.adminName} loses ${revoking.capability} for ${revoking.organizationName}.`
            : undefined
        }
        confirmLabel="Revoke grant"
        tone="danger"
        busy={busy}
      >
        {revokeError ? <InlineError>{revokeError}</InlineError> : null}
      </ConfirmDialog>

      <ReauthDialog
        open={reauth}
        email={me?.user.email ?? ''}
        onClose={() => {
          setReauth(false);
          setRetryRevoke(false);
        }}
        onDone={() => {
          setReauth(false);
          if (retryRevoke) {
            setRetryRevoke(false);
            void revoke();
          }
        }}
      />
    </>
  );
}

function CreateGrantDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const users = useApiData<AdminUserSummary[]>(open ? '/api/v1/admin/users' : null);
  const orgs = useApiData<OrganizationSummary[]>(open ? '/api/v1/admin/organizations' : null);
  const sites = useApiData<PlatformSiteSummary[]>(open ? '/api/v1/admin/sites' : null);

  const [adminUserId, setAdminUserId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [capability, setCapability] = useState(CAPABILITIES[0]!.value);
  const [expiry, setExpiry] = useState(defaultExpiry());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const admins = (users.data ?? []).filter((user) =>
    user.memberships.some((membership) => membership.role === 'PLATFORM_ADMIN' && membership.status === 'ACTIVE'),
  );
  const orgSites = (sites.data ?? []).filter((site) => site.organizationId === organizationId);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!adminUserId || !organizationId || !reason.trim()) {
      setError('Choose an administrator and organization, then give a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await request('/api/v1/admin/grants', {
        method: 'POST',
        body: {
          adminUserId,
          organizationId,
          ...(siteId ? { siteId } : {}),
          capability,
          expiresAt: new Date(expiry).toISOString(),
          reason: reason.trim(),
        },
      });
      flash('Grant created.');
      onCreated();
      onClose();
      setReason('');
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you and the grant will be retried.');
      } else {
        setError(errorMessage(cause, 'The grant could not be created.'));
        setFields(fieldErrors(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => undefined : onClose}
        title="Create an access grant"
        description="Time-boxed operational visibility for one administrator. Never grant broader scope than the task needs."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              form="grant-form"
              loading={busy}
              disabled={!adminUserId || !organizationId || reason.trim().length < 5}
            >
              Create grant
            </Button>
          </>
        }
      >
        <form id="grant-form" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <Field label="Administrator" htmlFor="grant-admin" error={fields.adminUserId?.[0]}>
            <Select
              id="grant-admin"
              value={adminUserId}
              onChange={(event) => setAdminUserId(event.target.value)}
            >
              <option value="">Select an administrator</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name} · {admin.email}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organization" htmlFor="grant-org" error={fields.organizationId?.[0]}>
              <Select
                id="grant-org"
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setSiteId('');
                }}
              >
                <option value="">Select an organization</option>
                {(orgs.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Site" htmlFor="grant-site" optional hint="Leave empty for the whole organization.">
              <Select
                id="grant-site"
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                disabled={!organizationId}
              >
                <option value="">All sites</option>
                {orgSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Capability" htmlFor="grant-capability">
            <Select
              id="grant-capability"
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            >
              {CAPABILITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Expires"
            htmlFor="grant-expiry"
            hint="Within 30 days. Shorter is better."
          >
            <Input
              id="grant-expiry"
              type="datetime-local"
              value={expiry}
              min={defaultExpiry(1 / 48)}
              max={defaultExpiry(30)}
              onChange={(event) => setExpiry(event.target.value)}
            />
          </Field>
          <Field label="Reason" htmlFor="grant-reason" error={fields.reason?.[0]} hint="At least 5 characters. Stored in the audit log.">
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Investigating a payroll dispute for the week of 9 November."
            />
          </Field>
        </form>
      </Modal>

      <ReauthDialog
        open={reauth}
        email={me?.user.email ?? ''}
        onClose={() => {
          setReauth(false);
          setPendingRetry(false);
        }}
        onDone={() => {
          setReauth(false);
          if (pendingRetry) {
            setPendingRetry(false);
            void submit();
          }
        }}
      />
    </>
  );
}

function defaultExpiry(offsetDays = 1) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
