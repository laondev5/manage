'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { OwnerOverview } from '../../contracts/index';
import { hasCapability, isAdmin, useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/use-api-data';
import { alertStateBadge } from '@/components/status';
import { WorkspaceNotice } from '@/components/app-shell';
import {
  IconAlert,
  IconBell,
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconRefresh,
  IconUsers,
} from '@/components/icons';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DeniedState,
  EmptyState,
  ErrorState,
  PageHeader,
  PageLoading,
  StatCard,
  StatGridSkeleton,
} from '@/components/ui';
import { relativeTime } from '@/lib/format';

export default function OverviewPage() {
  const { me } = useAuth();
  const router = useRouter();
  const admin = isAdmin(me);
  const owner = hasCapability(me, 'owner.overview');

  useEffect(() => {
    if (me && !owner && admin) router.replace('/admin');
  }, [me, owner, admin, router]);

  if (!me) return null;
  if (!owner) {
    if (admin) return <PageLoading label="Opening the platform overview" />;
    return (
      <div className="space-y-4">
        <WorkspaceNotice />
        <DeniedState
          title="This workspace is for site owners"
          message="Your account is a staff account. Clock in, check your history, and raise corrections in the Manage mobile app. Site owners handle rosters, alerts, and timesheets here."
        />
      </div>
    );
  }
  return <OwnerOverviewContent />;
}

function OwnerOverviewContent() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useApiData<OwnerOverview>('/api/v1/owner/overview');
  const orgName =
    me?.memberships.find((membership) => membership.organizationId === me.activeOrganizationId)
      ?.organizationName ?? 'Your organization';

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${me?.user.name.split(' ')[0] ?? 'there'}`}
        description={`Live attendance and alert activity for ${orgName}. Counts refresh on demand — they are not a live socket feed.`}
        actions={
          <Button variant="secondary" onClick={reload} icon={<IconRefresh className="h-4 w-4" />} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {loading && !data ? <StatGridSkeleton /> : null}
      {error ? (
        <ErrorState
          message="The overview could not be loaded. Check that the API is running and that your membership is still active."
          onRetry={reload}
        />
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="On site now"
              value={data.staffOnSite}
              hint={`${data.staffAssigned} staff assigned across ${data.sites.length} site${data.sites.length === 1 ? '' : 's'}`}
              icon={<IconUsers className="h-4.5 w-4.5" />}
              tone="blue"
            />
            <StatCard
              label="Open alerts"
              value={data.openAlerts}
              hint={data.openAlerts ? 'Departures waiting for a review' : 'No unread departures'}
              icon={<IconBell className="h-4.5 w-4.5" />}
              tone={data.openAlerts ? 'warn' : 'default'}
              href="/alerts"
            />
            <StatCard
              label="Pending corrections"
              value={data.pendingCorrections}
              hint={data.pendingCorrections ? 'Staff waiting on a decision' : 'Nothing to decide'}
              icon={<IconCheck className="h-4.5 w-4.5" />}
              tone={data.pendingCorrections ? 'warn' : 'default'}
              href="/team?tab=corrections"
            />
            <StatCard
              label="Hours today"
              value={`${data.hoursToday.toFixed(1)} h`}
              hint="Completed shifts that started today"
              icon={<IconClock className="h-4.5 w-4.5" />}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <Card>
              <CardHeader
                title="Sites"
                description="Staff counts come from attendance, presence is the latest qualified location reading."
                action={
                  hasCapability(me, 'owner.sites') ? (
                    <Link
                      href="/sites"
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-cobalt hover:underline"
                    >
                      Manage sites <IconChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null
                }
              />
              {data.sites.length ? (
                <ul className="divide-y divide-line">
                  {data.sites.map((site) => {
                    const content = (
                      <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#fafbfe]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted">
                          <IconBuilding className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-ink">{site.name}</p>
                          <p className="mt-0.5 text-[12px] text-muted">
                            {site.onSiteCount} of {site.assignedCount} on site
                            {site.presenceUncertain
                              ? ` · ${site.presenceUncertain} location uncertain`
                              : ''}
                          </p>
                        </div>
                        {site.openAlerts ? (
                          <Badge tone="amber">{site.openAlerts} alert{site.openAlerts === 1 ? '' : 's'}</Badge>
                        ) : (
                          <Badge tone="slate">Clear</Badge>
                        )}
                        <IconChevronRight className="h-4 w-4 shrink-0 text-[#b4bdcc]" />
                      </div>
                    );
                    return (
                      <li key={site.id}>
                        {hasCapability(me, 'owner.sites') ? (
                          <Link href={`/sites/${site.id}`}>{content}</Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<IconBuilding className="h-5 w-5" />}
                  title="No sites yet"
                  description="Create a site with a location and presence radius before inviting staff."
                  compact
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent departures"
                description="Most recent alerts for the sites you own."
                action={
                  <Link href="/alerts" className="text-[12.5px] font-medium text-cobalt hover:underline">
                    All alerts
                  </Link>
                }
              />
              {data.recentAlerts.length ? (
                <ul className="divide-y divide-line">
                  {data.recentAlerts.map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#fafbfe]"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
                          <IconAlert className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{alert.workerName}</p>
                          <p className="mt-0.5 truncate text-[12px] text-muted">
                            {alert.siteName} · {relativeTime(alert.detectedAt)}
                          </p>
                        </div>
                        {alertStateBadge(alert.state)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<IconBell className="h-5 w-5" />}
                  title="No departure alerts"
                  description="When location observations show a staff member leaving a site, the alert appears here."
                  compact
                />
              )}
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11.5px] text-[#8b97ab]">
            <span>Generated {new Date(data.generatedAt).toLocaleString('en-GB')}</span>
            <span className="flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5" />
              Attendance, presence, and review are tracked separately.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
