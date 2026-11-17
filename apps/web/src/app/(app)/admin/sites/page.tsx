'use client';

import { useMemo, useState } from 'react';
import type { PlatformSiteSummary } from '@manage/contracts';
import { RequireAdmin } from '@/components/app-shell';
import { IconBuilding, IconPin, IconRefresh } from '@/components/icons';
import { TIMEZONES } from '@/components/site-form';
import {
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
  Td,
  Textarea,
  Th,
  useFlash,
} from '@/components/ui';
import { ReauthDialog, isRecentAuthError } from '@/components/reauth';
import { errorMessage, fieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/use-api-data';

export default function AdminSitesPage() {
  return (
    <RequireAdmin>
      <SitesContent />
    </RequireAdmin>
  );
}

function SitesContent() {
  const { data, error, loading, reload } = useApiData<PlatformSiteSummary[]>('/api/v1/admin/sites');
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [editing, setEditing] = useState<PlatformSiteSummary | null>(null);

  const organizations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const site of data ?? []) seen.set(site.organizationId, site.organizationName);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtered = (data ?? []).filter((site) => {
    if (organizationId && site.organizationId !== organizationId) return false;
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
      site.name.toLowerCase().includes(needle) ||
      site.organizationName.toLowerCase().includes(needle) ||
      site.timezone.toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <PageHeader
        title="Platform sites"
        description="Every site across organizations. Administrative changes require recent sign-in and a recorded reason."
        actions={
          <Button
            variant="secondary"
            onClick={reload}
            loading={loading}
            icon={<IconRefresh className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Sites"
          description={`${data?.length ?? 0} sites`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                aria-label="Filter by organization"
                className="w-48"
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
              <SearchInput value={query} onChange={setQuery} placeholder="Search sites" className="w-52" />
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
          <ErrorState message={errorMessage(error, 'Sites could not be loaded.')} onRetry={reload} />
        ) : filtered.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Site</Th>
                <Th>Organization</Th>
                <Th>Policy</Th>
                <Th>Staff</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((site) => (
                <tr key={site.id} className="hover:bg-[#fafbfe]">
                  <Td>
                    <p className="text-[13.5px] font-medium text-ink">{site.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {site.timezone} · v{site.policyVersion}
                    </p>
                  </Td>
                  <Td className="text-muted">{site.organizationName}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink">
                      <IconPin className="h-3.5 w-3.5 text-muted" />
                      {site.radiusMeters} m radius
                    </span>
                  </Td>
                  <Td className="text-muted tabular">{site.staffCount}</Td>
                  <Td>
                    <Badge tone={site.status === 'ACTIVE' ? 'blue' : 'slate'}>
                      {site.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(site)}>
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<IconBuilding className="h-5 w-5" />}
            title={query || organizationId ? 'No matching sites' : 'No sites yet'}
            description={
              query || organizationId
                ? 'Adjust the filters to see more sites.'
                : 'Sites appear here once an owner creates one.'
            }
          />
        )}
        <div className="border-t border-line px-5 py-3">
          <InlineNotice>
            Changing a site&apos;s radius bumps its policy version, which the mobile app uses to detect stale
            policy before clocking in. Record a reason that will stand up in an audit review.
          </InlineNotice>
        </div>
      </Card>

      {editing ? (
        <EditSiteDialog key={editing.id} site={editing} onClose={() => setEditing(null)} onSaved={reload} />
      ) : null}
    </div>
  );
}

function EditSiteDialog({
  site,
  onClose,
  onSaved,
}: {
  site: PlatformSiteSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [name, setName] = useState(site.name);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(site.status);
  const [radiusMeters, setRadiusMeters] = useState(String(site.radiusMeters));
  const [timezone, setTimezone] = useState(site.timezone);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const timezones = timezone && !TIMEZONES.includes(timezone) ? [timezone, ...TIMEZONES] : TIMEZONES;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (reason.trim().length < 5) {
      setError('Give a reason of at least 5 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await request(`/api/v1/admin/sites/${site.id}`, {
        method: 'PATCH',
        body: {
          ...(name.trim() !== site.name ? { name: name.trim() } : {}),
          ...(status !== site.status ? { status } : {}),
          ...(Number(radiusMeters) !== site.radiusMeters ? { radiusMeters: Number(radiusMeters) } : {}),
          ...(timezone !== site.timezone ? { timezone } : {}),
          version: site.version,
          reason: reason.trim(),
        },
      });
      flash(`${site.name} updated.`);
      onSaved();
      onClose();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setError('Your session is older than 15 minutes. Confirm it is you and the change will be retried.');
      } else {
        setError(errorMessage(cause, 'The site could not be updated.'));
        setFields(fieldErrors(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={busy ? () => undefined : onClose}
        title="Edit site"
        description={`${site.name} · ${site.organizationName}`}
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form="admin-site-form" loading={busy} disabled={reason.trim().length < 5}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="admin-site-form" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <Field label="Name" htmlFor="admin-site-name" error={fields.name?.[0]}>
            <Input id="admin-site-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status" htmlFor="admin-site-status">
              <Select
                id="admin-site-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
            <Field
              label="Radius"
              htmlFor="admin-site-radius"
              error={fields.radiusMeters?.[0]}
              hint="50–2,000 m"
            >
              <Input
                id="admin-site-radius"
                type="number"
                min={50}
                max={2000}
                step={10}
                value={radiusMeters}
                onChange={(event) => setRadiusMeters(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Timezone" htmlFor="admin-site-tz" error={fields.timezone?.[0]} hint="IANA timezone, e.g. Africa/Lagos.">
            <Select id="admin-site-tz" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Reason"
            htmlFor="admin-site-reason"
            error={fields.reason?.[0]}
            hint="Stored in the audit log. At least 5 characters."
          >
            <Textarea
              id="admin-site-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Owner reported GPS drift at the gate; widening radius by 20 m after site visit."
            />
          </Field>
          <p className="text-[11.5px] text-muted">
            Current policy version v{site.policyVersion}. Saving changes only if the site has not changed
            since this page loaded.
          </p>
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
