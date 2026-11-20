'use client';

import Link from 'next/link';
import { AdminAccountEditor } from '@/components/admin-account-editor';
import { CreateAccount } from '@/components/create-account';
import { useEffect, useState } from 'react';
import type { AdminInviteResult, AdminUserSummary, OrganizationSummary, PlatformSiteSummary } from '../../../../contracts/index';
import { RequireAdmin } from '@/components/app-shell';
import { membershipBadge } from '@/components/status';
import { IconMail, IconPlus, IconShield, IconX } from '@/components/icons';
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
      <CreateAccount admin /><UsersContent />
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
  const { me } = useAuth();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminUserSummary | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reactivating, setReactivating] = useState<AdminUserSummary | null>(null);
  const [deleting, setDeleting] = useState<AdminUserSummary | null>(null);
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
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setInviteOpen(true)} icon={<IconPlus className="h-3.5 w-3.5" />}>
              Create account
            </Button>
            <SearchInput value={query} onChange={setQuery} placeholder="Search users" className="w-56" />
          </div>
        }
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
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-[#fafbfe]">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <button className="truncate text-[13.5px] font-medium text-cobalt underline" onClick={() => setEditing(user)}>{user.name}</button>
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
                    {user.accountStatus === 'DISABLED' ? (
                      <Badge tone="amber">Deactivated</Badge>
                    ) : null}
                    {user.accountStatus === 'DELETED' ? (
                      <Badge tone="red">Deleted</Badge>
                    ) : null}
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
                <Td className="text-muted">
                  <div className="flex items-center gap-2">
                    <span>{formatDate(user.createdAt)}</span>
                    {user.accountStatus === 'DISABLED' ? (
                      <Button variant="ghost" size="sm" onClick={() => setReactivating(user)}>
                        Reactivate
                      </Button>
                    ) : null}
                  </div>
                </Td>
                <Td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(user)}
                    disabled={user.id === me?.user.id || user.accountStatus === 'DELETED'}
                    icon={<IconX className="h-3.5 w-3.5" />}
                  >
                    Delete
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState
          icon={<IconMail className="h-5 w-5" />}
          title={query ? 'No matching users' : 'No users yet'}
          description="Create staff, owners, and administrators using the account form."
        />
      )}
      {inviteOpen ? <><Button variant="secondary" onClick={() => setInviteOpen(false)}>Close account form</Button><CreateAccount admin onCreated={reload} /></> : null}
      {editing ? <><Button variant="secondary" onClick={() => setEditing(null)}>Close editor</Button><AdminAccountEditor key={editing.id} user={editing} onSaved={reload} /></> : null}
      <ReactivateDialog
        user={reactivating}
        onClose={() => setReactivating(null)}
        onReactivated={reload}
      />
      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={reload}
      />
    </Card>
  );
}

function ReactivateDialog({
  user,
  onClose,
  onReactivated,
}: {
  user: AdminUserSummary | null;
  onClose: () => void;
  onReactivated: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/admin/users/${user.id}/reactivate`, {
        method: 'POST',
        body: { reason: reason.trim() },
      });
      flash(`${user.name} can sign in again.`);
      setReason('');
      onClose();
      onReactivated();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you, then the change will retry.');
      } else {
        setError(errorMessage(cause, 'The account could not be reactivated.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(user)}
        onClose={busy ? () => undefined : onClose}
        title="Reactivate account"
        description={user?.email}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button size="sm" type="submit" form="reactivate-user" loading={busy} disabled={reason.trim().length < 5}>
              Reactivate
            </Button>
          </>
        }
      >
        <form id="reactivate-user" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <InlineNotice>
            Reactivating restores access. The account keeps its memberships and any MFA enrollment.
          </InlineNotice>
          <Field label="Reason" htmlFor="reactivate-reason" hint="At least 5 characters. Recorded in the audit log.">
            <Input
              id="reactivate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why access is being restored"
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
          if (pendingRetry) void submit();
        }}
      />
    </>
  );
}

function DeleteUserDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUserSummary | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        body: { reason: reason.trim() },
      });
      flash(`${user.name} was deleted. Access was revoked; attendance history was retained.`);
      setReason('');
      onClose();
      onDeleted();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you, then the deletion will retry.');
      } else {
        setError(errorMessage(cause, 'The account could not be deleted.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(user)}
        onClose={busy ? () => undefined : onClose}
        title="Delete account"
        description={user?.email}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              form="delete-user"
              loading={busy}
              disabled={reason.trim().length < 5 || user?.id === me?.user.id}
            >
              Delete account
            </Button>
          </>
        }
      >
        <form id="delete-user" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <InlineNotice tone="warn">
            This revokes all memberships, site assignments, sessions, devices, grants, and pending
            invitations. The identity remains so attendance and audit history stay attributable. This
            cannot be undone from the app.
          </InlineNotice>
          <Field label="Reason" htmlFor="delete-user-reason" hint="At least 5 characters. Recorded in the audit log.">
            <Input
              id="delete-user-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why access is being permanently removed"
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

function LegacyInviteAdminDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const orgs = useApiData<OrganizationSummary[]>(open ? '/api/v1/admin/organizations' : null);
  const [email, setEmail] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<AdminInviteResult | null>(null);
  const [reauth, setReauth] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setOrganizationId('');
    setNote('');
    setError(null);
    setFields({});
    setResult(null);
  }, [open]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || !organizationId) {
      setError('Enter an email address and choose an organization.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const invite = await request<AdminInviteResult>('/api/v1/admin/admins', {
        method: 'POST',
        body: {
          email: email.trim(),
          organizationId,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setResult(invite);
      flash('Administrator invited.');
      onInvited();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you and the invitation will be retried.');
      } else {
        setError(errorMessage(cause, 'The administrator could not be invited.'));
        setFields(fieldErrors(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  function close() {
    setReauth(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => undefined : close}
        title="Create account"
        description="Creates another platform administrator. They choose their own password from the invitation email."
        footer={
          result ? (
            <Button size="sm" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                form="invite-admin"
                loading={busy}
                disabled={!email.trim() || !organizationId}
              >
                Send invitation
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-3">
            <InlineNotice tone="success">
              Invitation recorded for {result.email} as {roleLabel(result.role)}. It expires{' '}
              {formatDateTime(result.expiresAt)}.
            </InlineNotice>
            {result.developmentToken ? (
              <div className="rounded-lg border border-line bg-canvas px-3 py-3">
                <p className="text-[13px] font-semibold text-ink">Development only — no email was sent</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  This setup token is issued only in development and is never returned in production, where
                  the invitation is delivered by email instead.
                </p>
                <code className="mt-2 block select-all break-all rounded border border-line bg-white px-2.5 py-2 font-mono text-[12.5px] text-ink">
                  {result.developmentToken}
                </code>
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted">
                The invitation email was sent to {result.email}. They set their own password before it expires.
              </p>
            )}
          </div>
        ) : (
          <form id="invite-admin" onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Email" htmlFor="admin-email" error={fields.email?.[0]}>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
              />
            </Field>
            <Field
              label="Organization"
              htmlFor="admin-org"
              error={fields.organizationId?.[0]}
              hint="The organization this administrator belongs to."
            >
              <Select
                id="admin-org"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                disabled={orgs.loading && !orgs.data}
              >
                <option value="">Select an organization</option>
                {(orgs.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="admin-note" optional hint="Context for the audit log.">
              <Textarea
                id="admin-note"
                value={note}
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Onboarding the new operations lead."
              />
            </Field>
          </form>
        )}
      </Modal>

      <ReauthDialog
        open={reauth}
        email={me?.user.email ?? ''}
        onClose={() => setReauth(false)}
        onDone={() => {
          setReauth(false);
          void submit();
        }}
      />
    </>
  );
}

// Retained legacy workflow.
void LegacyInviteAdminDialog;
