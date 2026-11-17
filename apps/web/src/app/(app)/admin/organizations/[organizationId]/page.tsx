'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireAdmin } from '@/components/app-shell';
import { membershipBadge, organizationBadge } from '@/components/status';
import { IconBuilding, IconPin, IconShield, IconUsers } from '@/components/icons';
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
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, roleLabel } from '@/lib/format';
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
        actions={<>{organizationBadge(data.status)}</>}
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
              description="Invite a site owner from the owner workspace, or have them join through an invitation."
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
