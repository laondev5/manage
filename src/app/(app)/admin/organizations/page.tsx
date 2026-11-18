'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { OrganizationSummary } from '../../../../contracts/index';
import { RequireAdmin } from '@/components/app-shell';
import { organizationBadge } from '@/components/status';
import { IconAlert, IconBuilding, IconChevronRight, IconPlus } from '@/components/icons';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  TableWrap,
  Td,
  Th,
  useFlash,
} from '@/components/ui';
import { ReauthDialog, isRecentAuthError } from '@/components/reauth';
import { errorMessage, fieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const TIMEZONES = ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg', 'Europe/London', 'Europe/Paris', 'America/New_York', 'Asia/Dubai', 'Asia/Singapore', 'UTC'];

export default function AdminOrganizationsPage() {
  return (
    <RequireAdmin>
      <OrganizationsContent />
    </RequireAdmin>
  );
}

type OrgDetail = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  contactEmail: string;
  timezone: string;
  version: number;
};

function OrganizationsContent() {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationSummary | null>(null);
  const [deleting, setDeleting] = useState<OrganizationSummary | null>(null);
  const { data, error, loading, reload } = useApiData<OrganizationSummary[]>('/api/v1/admin/organizations');

  const filtered = (data ?? []).filter((org) =>
    query ? org.name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Tenants on this deployment. Suspending an organization blocks new clock-ins without deleting records."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<IconPlus className="h-4 w-4" />}>
            New organization
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <SearchInput value={query} onChange={setQuery} placeholder="Search organizations" />
      </div>

      <Card>
        {loading && !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error, 'Organizations could not be loaded.')} onRetry={reload} />
        ) : filtered.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th>Status</Th>
                <Th className="text-right">Sites</Th>
                <Th className="text-right">Members</Th>
                <Th className="text-right">Working now</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr key={org.id} className="hover:bg-[#fafbfe]">
                  <Td>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="inline-flex items-center gap-2 font-medium text-ink hover:text-cobalt"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas text-muted">
                        <IconBuilding className="h-3.5 w-3.5" />
                      </span>
                      {org.name}
                    </Link>
                  </Td>
                  <Td>{organizationBadge(org.status)}</Td>
                  <Td className="text-right tabular">{org.siteCount}</Td>
                  <Td className="text-right tabular">{org.memberCount}</Td>
                  <Td className="text-right tabular">{org.workingNow}</Td>
                  <Td className="text-muted">{formatDate(org.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(org)}>
                        Edit
                      </Button>
                      <Link href={`/admin/organizations/${org.id}`}>
                        <Button variant="ghost" size="sm" icon={<IconChevronRight className="h-3.5 w-3.5" />}>
                          Open
                        </Button>
                      </Link>
                      <Button variant="danger" size="sm" onClick={() => setDeleting(org)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<IconBuilding className="h-5 w-5" />}
            title={query ? 'No matching organizations' : 'No organizations yet'}
            description={
              query ? 'Try another name.' : 'Create the first organization, then invite its site owner.'
            }
            action={
              !query ? (
                <Button size="sm" onClick={() => setCreateOpen(true)} icon={<IconPlus className="h-4 w-4" />}>
                  New organization
                </Button>
              ) : null
            }
          />
        )}
      </Card>

      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} />
      <EditOrgDialog organization={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <DeleteOrgDialog organization={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </div>
  );
}

function CreateOrgDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { request } = useAuth();
  const flash = useFlash();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await request('/api/v1/admin/organizations', {
        method: 'POST',
        body: { name: name.trim(), contactEmail: email.trim(), timezone },
      });
      flash('Organization created.');
      setName('');
      setEmail('');
      onCreated();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, 'The organization could not be created.'));
      setFields(fieldErrors(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="New organization"
      description="A tenant for one client. Sites, staff, and alerts are scoped to it."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="create-org" loading={busy} disabled={!name || !email}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-org" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineError>{error}</InlineError> : null}
        <Field label="Organization name" htmlFor="org-name" error={fields.name?.[0]}>
          <Input
            id="org-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Northwind Facilities"
          />
        </Field>
        <Field label="Owner contact email" htmlFor="org-email" error={fields.contactEmail?.[0]} hint="Where operational notices are sent.">
          <Input
            id="org-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ops@northwind.example"
          />
        </Field>
        <Field label="Timezone" htmlFor="org-tz">
          <Select id="org-tz" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function EditOrgDialog({
  organization,
  onClose,
  onSaved,
}: {
  organization: OrganizationSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<OrgDetail['status']>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const open = async () => {
    if (!organization) return;
    setLoading(true);
    setError(null);
    try {
      const result = await request<OrgDetail>(`/api/v1/admin/organizations/${organization.id}`);
      setDetail(result);
      setName(result.name);
      setEmail(result.contactEmail);
      setStatus(result.status);
    } catch (cause) {
      setError(errorMessage(cause, 'The organization could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!organization) {
      setDetail(null);
      return;
    }
    void open();
    // Re-run only when a different organization opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/admin/organizations/${detail.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), contactEmail: email.trim(), status, version: detail.version },
      });
      flash('Organization updated.');
      onSaved();
      close();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you, then the change will retry.');
      } else {
        setError(errorMessage(cause, 'The organization could not be updated.'));
      }
    } finally {
      setBusy(false);
    }
  };

  function close() {
    setDetail(null);
    setError(null);
    setReauth(false);
    setPendingRetry(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={Boolean(organization)}
        onClose={busy ? () => undefined : close}
        title="Edit organization"
        description={organization?.name}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              form="edit-org"
              loading={busy}
              disabled={!detail || loading}
            >
              Save changes
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form id="edit-org" onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Name" htmlFor="edit-org-name">
              <Input id="edit-org-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Owner contact email" htmlFor="edit-org-email">
              <Input
                id="edit-org-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field
              label="Status"
              htmlFor="edit-org-status"
              hint="Suspended organizations cannot clock in. Archived is a read-only state."
            >
              <Select
                id="edit-org-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as OrgDetail['status'])}
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
            <div className="rounded-lg bg-canvas px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
              Version {detail?.version ?? '—'}. If someone else edits this organization first, the save is
              rejected as a conflict instead of overwriting their change.
            </div>
          </form>
        )}
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

function DeleteOrgDialog({
  organization,
  onClose,
  onDeleted,
}: {
  organization: OrganizationSummary | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  useEffect(() => {
    if (!organization) {
      setDetail(null);
      return;
    }
    setReason('');
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const result = await request<OrgDetail>(`/api/v1/admin/organizations/${organization.id}`);
        setDetail(result);
      } catch (cause) {
        setError(errorMessage(cause, 'The organization could not be loaded.'));
      } finally {
        setLoading(false);
      }
    })();
    // Re-run only when a different organization opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/admin/organizations/${detail.id}`, {
        method: 'DELETE',
        body: { version: detail.version, reason: reason.trim() },
      });
      flash('Organization deleted.');
      onDeleted();
      close();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you, then the deletion will retry.');
      } else {
        setError(errorMessage(cause, 'The organization could not be deleted.'));
      }
    } finally {
      setBusy(false);
    }
  };

  function close() {
    setDetail(null);
    setReason('');
    setError(null);
    setReauth(false);
    setPendingRetry(false);
    onClose();
  }

  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 5;

  return (
    <>
      <Modal
        open={Boolean(organization)}
        onClose={busy ? () => undefined : close}
        title="Delete organization"
        description={organization?.name}
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              form="delete-org"
              loading={busy}
              disabled={!detail || loading || reason.trim().length < 5}
            >
              Delete organization
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <form id="delete-org" onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <div className="flex items-start gap-2 rounded-lg border border-[#f6c8c4] bg-danger-soft px-3 py-3 text-[14px] leading-relaxed text-danger">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">This archives the organization and cannot be undone here.</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  <li>The organization is archived and access to every site is revoked.</li>
                  <li>Attendance and audit history are retained for compliance.</li>
                  <li>Users whose only organization was this one are disabled.</li>
                </ul>
              </div>
            </div>
            <Field
              label="Reason for deletion"
              htmlFor="delete-org-reason"
              hint="At least 5 characters. Stored in the audit log with your name."
              error={reasonTooShort ? 'Enter at least 5 characters.' : undefined}
            >
              <Input
                id="delete-org-reason"
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Client contract ended; archived at their request."
              />
            </Field>
            <div className="rounded-lg bg-canvas px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
              Version {detail?.version ?? '—'}. If someone else changes this organization first, the deletion
              is rejected as a conflict instead of removing stale data. Active shifts or the last platform
              administrator also block deletion.
            </div>
          </form>
        )}
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
