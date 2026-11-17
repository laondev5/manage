'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SiteSummary } from '@manage/contracts';
import { SiteForm, EMPTY_SITE_FORM, type SiteFormValues } from '@/components/site-form';
import { buildSitePayload, validateSiteForm } from '@/lib/site-payload';
import { IconBuilding, IconChevronRight, IconClock, IconPin, IconPlus, IconUsers } from '@/components/icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Skeleton,
  useFlash,
} from '@/components/ui';
import { errorMessage, fieldErrors } from '@/lib/api';
import { hasCapability, useAuth } from '@/lib/auth';
import { expectedHoursLabel } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

export default function SitesPage() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useApiData<SiteSummary[]>('/api/v1/sites');

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Each site carries its own location, presence radius, expected hours, and owner notifications."
        actions={
          hasCapability(me, 'owner.sites') ? (
            <CreateSiteButton onCreated={reload} />
          ) : null
        }
      />

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card-shadow rounded-2xl border border-line bg-white p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-3 w-48" />
              <Skeleton className="mt-6 h-3 w-40" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <ErrorState message={errorMessage(error, 'Sites could not be loaded.')} onRetry={reload} />
      ) : null}

      {data ? (
        data.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`} className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt">
                <Card className="h-full transition-colors group-hover:border-[#c9d5ea]">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-ink">{site.name}</p>
                        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{site.address}</p>
                      </div>
                      <Badge tone={site.status === 'ACTIVE' ? 'blue' : 'slate'}>
                        {site.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-line pt-3.5">
                      <div className="flex items-center gap-2 text-[12.5px] text-muted">
                        <IconUsers className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {site.onSiteCount ?? 0} on site
                          {site.staffCount !== undefined ? ` · ${site.staffCount} assigned` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[12.5px] text-muted">
                        <IconPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{site.radiusMeters} m radius · {site.timezone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12.5px] text-muted">
                        <IconClock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{expectedHoursLabel(site.expectedHours)}</span>
                      </div>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between text-[12px]">
                      <span className="text-[#8b97ab]">Policy v{site.policyVersion}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-cobalt">
                        Open <IconChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<IconBuilding className="h-5 w-5" />}
              title="Create your first site"
              description="A site is one worksite with a fixed centre and a presence radius. Staff can only clock in at sites they are assigned to."
              action={<CreateSiteButton onCreated={reload} />}
            />
          </Card>
        )
      ) : null}
    </div>
  );
}

function CreateSiteButton({ onCreated }: { onCreated: () => void }) {
  const { request, activeOrgId } = useAuth();
  const flash = useFlash();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SiteFormValues>(EMPTY_SITE_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const submit = async () => {
    const invalid = validateSiteForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!activeOrgId) {
      setError('Choose an organization before creating a site.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await request('/api/v1/sites', { method: 'POST', body: buildSitePayload(values, activeOrgId) });
      flash('Site created.');
      setOpen(false);
      setValues(EMPTY_SITE_FORM);
      onCreated();
    } catch (cause) {
      setError(errorMessage(cause, 'The site could not be created.'));
      setFields(fieldErrors(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<IconPlus className="h-4 w-4" />}>
        New site
      </Button>
      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title="Create a site"
        description="You can refine presence rules later; every change creates a new policy version."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" form="create-site-form" type="submit" loading={busy}>
              Create site
            </Button>
          </>
        }
      >
        <SiteForm
          formId="create-site-form"
          mode="create"
          values={values}
          onChange={setValues}
          onSubmit={submit}
          busy={busy}
          error={error}
          fieldErrors={fields}
        />
      </Modal>
    </>
  );
}
