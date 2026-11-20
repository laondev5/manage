'use client';

import { CreateAccount } from '@/components/create-account';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminInviteResult } from '../../../../../contracts/index';
import { RequireAdmin } from '@/components/app-shell';
import { membershipBadge, organizationBadge } from '@/components/status';
import { IconBuilding, IconPin, IconPlus, IconShield, IconUsers } from '@/components/icons';
import {
  Avatar,
  Badge,
  Breadcrumb,
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
  Select,
  Skeleton,
  TableWrap,
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

type OrgDetail = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  contactEmail: string;
  timezone: string;
  version: number;
  createdAt: string;
  workingNow: number;
  sites: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    radiusMeters: number;
    timezone: string;
    policyVersion: number;
  }>;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    role: 'PLATFORM_ADMIN' | 'SITE_OWNER' | 'STAFF';
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  }>;
};

export default function AdminOrganizationDetailPage() {
  return (
    <RequireAdmin>
      <OrganizationDetailContent />
    </RequireAdmin>
  );
}

function OrganizationDetailContent() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = typeof params.organizationId === 'string' ? params.organizationId : '';
  const { data, error, loading, reload } = useApiData<OrgDetail>(
    organizationId ? `/api/v1/admin/organizations/${organizationId}` : null,
  );
  const [editing, setEditing] = useState<OrgDetail['members'][number] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: 'Organizations', href: '/admin/organizations' }, { label: 'Organization' }]} />
        <ErrorState
          message={errorMessage(error, 'The organization could not be loaded.')}
          onRetry={reload}
        />
      </div>
    );
  }

  const owners = data.members.filter((member) => member.role === 'SITE_OWNER');
  const staff = data.members.filter((member) => member.role === 'STAFF');

  return (
    <div>
      <div className="mb-2">
        <Breadcrumb
          items={[{ label: 'Organizations', href: '/admin/organizations' }, { label: data.name }]}
        />
      </div>
      <PageHeader
        title={data.name}
        description={`${data.contactEmail} · ${data.timezone} · created ${formatDate(data.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {organizationBadge(data.status)}
            <Button size="sm" onClick={() => setAddOpen(true)} icon={<IconPlus className="h-3.5 w-3.5" />}>
              Add owner or staff
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Sites</p>
          <p className="mt-1 text-[24px] font-semibold tabular text-ink">{data.sites.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Members</p>
          <p className="mt-1 text-[24px] font-semibold tabular text-ink">{data.members.length}</p>
          <p className="text-[11.5px] text-muted">{owners.length} owner{owners.length === 1 ? '' : 's'} · {staff.length} staff</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Working now</p>
          <p className="mt-1 text-[24px] font-semibold tabular text-ink">{data.workingNow}</p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Sites" description="Location and policy version for each site." />
          {data.sites.length ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Site</Th>
                  <Th>Status</Th>
                  <Th>Radius</Th>
                  <Th>Timezone</Th>
                  <Th>Policy</Th>
                </tr>
              </thead>
              <tbody>
                {data.sites.map((site) => (
                  <tr key={site.id}>
                    <Td>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <IconPin className="h-3.5 w-3.5 text-muted" />
                        {site.name}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={site.status === 'ACTIVE' ? 'blue' : 'slate'}>
                        {site.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td className="tabular">{site.radiusMeters} m</Td>
                    <Td className="text-muted">{site.timezone}</Td>
                    <Td className="text-muted tabular">v{site.policyVersion}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              icon={<IconBuilding className="h-5 w-5" />}
              title="No sites"
              description="The organization owner creates the first site from the owner workspace."
              compact
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Members"
            description="Changing a role or suspending access is audited and requires a recent sign-in."
          />
          {data.members.length ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.membershipId} className="hover:bg-[#fafbfe]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink">{member.name}</p>
                          <p className="truncate text-[12px] text-muted">{member.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        {member.role === 'PLATFORM_ADMIN' ? (
                          <IconShield className="h-3.5 w-3.5 text-cobalt" />
                        ) : null}
                        {roleLabel(member.role)}
                      </span>
                    </Td>
                    <Td>{membershipBadge(member.status)}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(member)}>
                        Change access
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              icon={<IconUsers className="h-5 w-5" />}
              title="No members"
              description="Create an owner or staff account using the account form."
              compact
            />
          )}
        </Card>

        <InlineNotice>
          Operational records for this organization — timesheets, location evidence, correction support — need
          an explicit grant from Users &amp; access. Membership changes alone do not expose them.
        </InlineNotice>
      </div>

      <ChangeAccessDialog
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      {addOpen ? <><Button variant="secondary" onClick={() => setAddOpen(false)}>Close account form</Button><CreateAccount admin onCreated={reload} /></> : null}
    </div>
  );
}

function ChangeAccessDialog({
  member,
  onClose,
  onSaved,
}: {
  member: OrgDetail['members'][number] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'REVOKED'>('ACTIVE');
  const [role, setRole] = useState<'STAFF' | 'SITE_OWNER'>('STAFF');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  useEffect(() => {
    if (!member) return;
    setStatus(member.status);
    setRole(member.role === 'PLATFORM_ADMIN' ? 'STAFF' : member.role);
    setReason('');
    setError(null);
  }, [member]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/v1/admin/memberships/${member.membershipId}`, {
        method: 'PATCH',
        body: {
          status,
          role,
          reason: reason.trim(),
        },
      });
      flash('Membership updated.');
      onSaved();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you, then save again.');
      } else {
        setError(errorMessage(cause, 'The membership could not be updated.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(member)}
        onClose={busy ? () => undefined : onClose}
        title="Change access"
        description={member ? `${member.name} · ${member.email}` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              form="change-access"
              loading={busy}
              disabled={member?.role === 'PLATFORM_ADMIN' || reason.trim().length < 5}
            >
              Save changes
            </Button>
          </>
        }
      >
        {member?.role === 'PLATFORM_ADMIN' ? (
          <InlineNotice tone="warn">
            Platform administrator memberships are managed outside this screen. Revoking the last active
            administrator is refused by the server.
          </InlineNotice>
        ) : (
          <form id="change-access" onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Role" htmlFor="access-role">
              <Select
                id="access-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'STAFF' | 'SITE_OWNER')}
              >
                <option value="STAFF">Staff</option>
                <option value="SITE_OWNER">Site owner</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="access-status" hint="Suspending access ends future clock-ins.">
              <Select
                id="access-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
              >
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REVOKED">Revoked</option>
              </Select>
            </Field>
            <Field
              label="Reason"
              htmlFor="access-reason"
              hint="At least 5 characters. Stored in the audit log with your name."
            >
              <Textarea
                id="access-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Owner left the business; access revoked at the client's request."
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

function LegacyAddMemberDialog({
  open,
  organizationId,
  sites,
  onClose,
  onAdded,
}: {
  open: boolean;
  organizationId: string;
  sites: OrgDetail['sites'];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SITE_OWNER' | 'STAFF'>('SITE_OWNER');
  const [siteId, setSiteId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<AdminInviteResult | null>(null);
  const [reauth, setReauth] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('SITE_OWNER');
    setSiteId('');
    setNote('');
    setError(null);
    setFields({});
    setResult(null);
  }, [open]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!organizationId || !email.trim()) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const invite = await request<AdminInviteResult>(
        `/api/v1/admin/organizations/${organizationId}/members`,
        {
          method: 'POST',
          body: {
            email: email.trim(),
            role,
            ...(siteId ? { siteId } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        },
      );
      setResult(invite);
      flash(role === 'SITE_OWNER' ? 'Owner invited.' : 'Staff member invited.');
      onAdded();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you and the invitation will be retried.');
      } else {
        setError(errorMessage(cause, 'The invitation could not be sent.'));
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
        title="Add owner or staff"
        description="An invitation email is sent; the recipient chooses their own password."
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
                form="add-member"
                loading={busy}
                disabled={!email.trim()}
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
          <form id="add-member" onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Email" htmlFor="member-email" error={fields.email?.[0]}>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@northwind.example"
              />
            </Field>
            <Field label="Role" htmlFor="member-role" hint="Owners manage sites and staff; staff clock in.">
              <Select
                id="member-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'SITE_OWNER' | 'STAFF')}
              >
                <option value="SITE_OWNER">Owner</option>
                <option value="STAFF">Staff</option>
              </Select>
            </Field>
            <Field label="Site" htmlFor="member-site" optional hint="Leave empty to apply to all sites.">
              <Select
                id="member-site"
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
              >
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="member-note" optional hint="Context for the audit log.">
              <Textarea
                id="member-note"
                value={note}
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Added at the client's request for the northern region."
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
void LegacyAddMemberDialog;
