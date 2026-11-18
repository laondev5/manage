'use client';

import Link from 'next/link';
import type { AdminOverview } from '../../../contracts/index';
import { RequireAdmin } from '@/components/app-shell';
import { IconActivity, IconAlert, IconBuilding, IconChevronRight, IconClock, IconRefresh, IconUsers } from '@/components/icons';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  InlineNotice,
  PageHeader,
  StatCard,
  StatGridSkeleton,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

export default function AdminOverviewPage() {
  return (
    <RequireAdmin>
      <AdminOverviewContent />
    </RequireAdmin>
  );
}

function AdminOverviewContent() {
  const { data, error, loading, reload } = useApiData<AdminOverview>('/api/v1/admin/overview');

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Aggregate counts across every organization. Operational attendance and location details still require an explicit scoped grant."
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

      {loading && !data ? <StatGridSkeleton count={4} /> : null}
      {error ? (
        <ErrorState message={errorMessage(error, 'The platform overview could not be loaded.')} onRetry={reload} />
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Organizations"
              value={data.organizations}
              hint={`${data.activeSites} active sites`}
              icon={<IconBuilding className="h-4.5 w-4.5" />}
              href="/admin/organizations"
              tone="blue"
            />
            <StatCard
              label="Working now"
              value={data.workingNow}
              hint={`${data.stalePresence} shifts with uncertain location`}
              icon={<IconUsers className="h-4.5 w-4.5" />}
            />
            <StatCard
              label="Open alerts"
              value={data.openAlerts}
              hint={`${data.pendingCorrections} corrections waiting`}
              icon={<IconAlert className="h-4.5 w-4.5" />}
              tone={data.openAlerts ? 'warn' : 'default'}
            />
            <StatCard
              label="Delivery backlog"
              value={data.outboxBacklog}
              hint={`${data.failedDeliveries} failed deliveries`}
              icon={<IconClock className="h-4.5 w-4.5" />}
              tone={data.failedDeliveries ? 'danger' : 'default'}
              href="/admin/health"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminLink
              href="/admin/health"
              title="System health"
              body="Database, worker heartbeat, outbox backlog, and notification providers."
            />
            <AdminLink
              href="/admin/audit"
              title="Audit log"
              body="Hash-chained record of administrative and operational actions."
            />
            <AdminLink
              href="/admin/users"
              title="Users & access"
              body="Accounts, MFA status, memberships, and expiring access grants."
            />
          </div>

          <InlineNotice>
            Admins do not gain operational visibility by default. Timesheets and location evidence require a
            scoped, expiring grant recorded in the audit log.
          </InlineNotice>

          <p className="text-[11.5px] text-[#8b97ab]">
            Generated {new Date(data.generatedAt).toLocaleString('en-GB')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AdminLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt">
      <Card className="h-full transition-colors group-hover:border-[#c9d5ea]">
        <CardHeader
          title={title}
          action={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas text-muted">
              <IconActivity className="h-4 w-4" />
            </span>
          }
        />
        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-relaxed text-muted">{body}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-cobalt">
            Open <IconChevronRight className="h-3.5 w-3.5" />
          </p>
        </div>
      </Card>
    </Link>
  );
}
