'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Health, Page } from '@manage/contracts';
import { RequireAdmin } from '@/components/app-shell';
import { deliveryBadge } from '@/components/status';
import { IconActivity, IconAlert, IconCheck, IconClock, IconRefresh, IconSpark } from '@/components/icons';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineError,
  InlineNotice,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatGridSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
  useFlash,
} from '@/components/ui';
import { ReauthDialog, isRecentAuthError } from '@/components/reauth';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

type Tab = 'health' | 'deliveries';

type Delivery = {
  id: string;
  recipientId: string;
  channel: string;
  state: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
};

const DELIVERY_STATES = ['', 'PENDING', 'LEASED', 'SENT', 'FAILED', 'DEAD', 'CANCELLED'] as const;

export default function AdminHealthPage() {
  return (
    <RequireAdmin>
      <HealthContent />
    </RequireAdmin>
  );
}

function HealthContent() {
  const [tab, setTab] = useState<Tab>('health');
  return (
    <div>
      <PageHeader
        title="System health"
        description="Database, worker heartbeat, notification outbox, and provider configuration. No secrets are shown."
      />
      <Tabs<Tab>
        className="mb-4 max-w-sm"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'health', label: 'Health' },
          { value: 'deliveries', label: 'Deliveries' },
        ]}
      />
      {tab === 'health' ? <HealthPanel /> : <DeliveriesPanel />}
    </div>
  );
}

function HealthPanel() {
  const { data, error, loading, reload } = useApiData<Health>('/api/v1/admin/health');

  const tone = data?.status === 'ok' ? 'blue' : data?.status === 'degraded' ? 'amber' : 'red';
  const label = data?.status === 'ok' ? 'Operational' : data?.status === 'degraded' ? 'Degraded' : 'Down';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {data ? <Badge tone={tone} dot>{label}</Badge> : <span />}
        <Button
          variant="secondary"
          icon={<IconRefresh className="h-4 w-4" />}
          onClick={reload}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {loading && !data ? <StatGridSkeleton count={4} /> : null}
      {error ? (
        <ErrorState message={errorMessage(error, 'Health data could not be loaded.')} onRetry={reload} />
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={data.worker.mode === 'scheduled' ? 'Worker scheduler' : 'Worker heartbeat'}
              value={
                data.worker.ageSeconds === null
                  ? 'No heartbeat'
                  : data.worker.ageSeconds < 90
                    ? `${data.worker.ageSeconds}s ago`
                    : `${Math.round(data.worker.ageSeconds / 60)}m ago`
              }
              hint={
                data.worker.state === 'ok'
                  ? data.worker.mode === 'scheduled'
                    ? 'The last scheduled tick completed. Delivery latency follows the schedule.'
                    : 'Worker is processing the outbox.'
                  : data.worker.state === 'stale'
                    ? data.worker.mode === 'scheduled'
                      ? 'The scheduled tick is overdue. Check the GitHub Actions run.'
                      : 'Heartbeat is stale. Alerts may be delayed.'
                    : 'No heartbeat recorded yet.'
              }
              icon={<IconActivity className="h-4.5 w-4.5" />}
              tone={data.worker.state === 'ok' ? 'default' : 'warn'}
            />
            <StatCard
              label="Outbox pending"
              value={data.outbox.pending}
              hint={
                data.outbox.oldestPendingAt
                  ? `Oldest ${relativeTime(data.outbox.oldestPendingAt)}`
                  : 'Nothing waiting'
              }
              icon={<IconClock className="h-4.5 w-4.5" />}
            />
            <StatCard
              label="Dead deliveries"
              value={data.outbox.dead}
              hint={data.outbox.leased ? `${data.outbox.leased} leased right now` : 'Require manual retry'}
              icon={<IconAlert className="h-4.5 w-4.5" />}
              tone={data.outbox.dead ? 'danger' : 'default'}
            />
            <StatCard
              label="Database"
              value={data.database === 'ok' ? 'Reachable' : 'Down'}
              hint={formatDateTime(data.checkedAt)}
              icon={<IconCheck className="h-4.5 w-4.5" />}
              tone={data.database === 'ok' ? 'default' : 'danger'}
            />
          </div>

          {data.status !== 'ok' ? (
            <InlineNotice tone="warn">
              Health is {data.status}. Check the worker process and the outbox. Departure alerts still record in
              the database; notification delivery may be delayed.
            </InlineNotice>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Notification providers" />
              <dl className="divide-y divide-line">
                <ProviderRow
                  label="Email"
                  provider={data.email.provider}
                  configured={data.email.configured}
                  configuredHint="Resend is configured."
                  fallbackHint="Local file adapter — emails are written to disk, not sent."
                />
                <ProviderRow
                  label="Push"
                  provider={data.push.provider}
                  configured={data.push.configured}
                  configuredHint="Expo push is configured."
                  fallbackHint="Local adapter — push notifications are recorded, not delivered."
                />
              </dl>
            </Card>
            <Card>
              <CardHeader title="Operational notes" />
              <div className="space-y-3 px-5 py-4 text-[12.5px] leading-relaxed text-muted">
                <p className="flex items-start gap-2">
                  <IconSpark className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
                  A clock-in is accepted only after the database commits it; offline events replay through the
                  same idempotent endpoint.
                </p>
                <p className="flex items-start gap-2">
                  <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
                  Dead deliveries have exhausted their retries. Retrying requeues them without duplicating
                  already-sent messages.
                </p>
                <p className="flex items-start gap-2">
                  <IconActivity className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
                  The worker claims outbox rows with leases, so multiple worker instances never send the same
                  notification twice.
                </p>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProviderRow({
  label,
  provider,
  configured,
  configuredHint,
  fallbackHint,
}: {
  label: string;
  provider: string;
  configured: boolean;
  configuredHint: string;
  fallbackHint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div>
        <dt className="text-[13px] font-medium text-ink">{label}</dt>
        <dd className="text-[11.5px] text-muted">{configured ? configuredHint : fallbackHint}</dd>
      </div>
      <Badge tone={configured ? 'blue' : 'amber'}>
        {configured ? provider : `local · ${provider}`}
      </Badge>
    </div>
  );
}

function DeliveriesPanel() {
  const { request, me } = useAuth();
  const flash = useFlash();
  const [state, setState] = useState<string>('');
  const [items, setItems] = useState<Delivery[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (state) params.set('state', state);
        if (nextCursor) params.set('cursor', nextCursor);
        const page = await request<Page<Delivery>>(`/api/v1/admin/deliveries?${params.toString()}`);
        setItems((current) => (replace ? page.items : [...current, ...page.items]));
        setCursor(page.nextCursor);
        if (replace) setSelected([]);
      } catch (cause) {
        setError(cause);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [request, state],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void fetchPage(null, true);
  }, [fetchPage]);

  const retryable = items.filter((item) => item.state === 'FAILED' || item.state === 'DEAD');
  const selectedRetryable = selected.filter((id) =>
    retryable.some((item) => item.id === id),
  );

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const reloadFirstPage = () => {
    void fetchPage(null, true);
  };

  const retry = async () => {
    setBusy(true);
    setRetryError(null);
    try {
      const result = await request<{ retried: number }>('/api/v1/admin/deliveries/retry', {
        method: 'POST',
        body: { outboxIds: selectedRetryable },
      });
      flash(`${result.retried} ${result.retried === 1 ? 'delivery' : 'deliveries'} requeued.`);
      setConfirming(false);
      setSelected([]);
      reloadFirstPage();
    } catch (cause) {
      if (isRecentAuthError(cause)) {
        setPendingRetry(true);
        setReauth(true);
        setRetryError('Your session is older than 15 minutes. Confirm it is you and the retry will continue.');
      } else {
        setRetryError(errorMessage(cause, 'The deliveries could not be retried.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Notification deliveries"
          description="Outbox rows for email and push. Failed and dead rows can be requeued."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={state}
                onChange={(event) => setState(event.target.value)}
                aria-label="Filter deliveries by state"
                className="w-40"
              >
                {DELIVERY_STATES.map((value) => (
                  <option key={value || 'all'} value={value}>
                    {value ? value[0]! + value.slice(1).toLowerCase() : 'All states'}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={reloadFirstPage}
                loading={loading}
                icon={<IconRefresh className="h-3.5 w-3.5" />}
              >
                Refresh
              </Button>
            </div>
          }
        />
        {retryable.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-2.5">
            <p className="text-[12px] text-muted">
              {selectedRetryable.length
                ? `${selectedRetryable.length} selected`
                : `${retryable.length} retryable on this page`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected(
                    selectedRetryable.length === retryable.length ? [] : retryable.map((item) => item.id),
                  )
                }
              >
                {selectedRetryable.length === retryable.length ? 'Clear' : 'Select retryable'}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setRetryError(null);
                  setConfirming(true);
                }}
                disabled={!selectedRetryable.length}
              >
                Retry selected
              </Button>
            </div>
          </div>
        ) : null}
        {loading && !items.length ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message={errorMessage(error, 'Deliveries could not be loaded.')}
            onRetry={reloadFirstPage}
          />
        ) : items.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-10" />
                  <Th>Recipient</Th>
                  <Th>Channel</Th>
                  <Th>State</Th>
                  <Th>Attempts</Th>
                  <Th>Next attempt</Th>
                  <Th>Last error</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const canRetry = item.state === 'FAILED' || item.state === 'DEAD';
                  return (
                    <tr key={item.id} className="align-top hover:bg-[#fafbfe]">
                      <Td>
                        <Checkbox
                          checked={selected.includes(item.id)}
                          onChange={() => toggle(item.id)}
                          disabled={!canRetry}
                          label={`Select delivery ${item.id}`}
                        />
                      </Td>
                      <Td>
                        <p className="font-mono text-[11.5px] text-ink">{item.recipientId}</p>
                        <p className="text-[10.5px] text-muted">queued {relativeTime(item.createdAt)}</p>
                      </Td>
                      <Td className="text-muted">{item.channel}</Td>
                      <Td>{deliveryBadge(item.state)}</Td>
                      <Td className="text-muted tabular">{item.attempts}</Td>
                      <Td className="whitespace-nowrap text-muted tabular">
                        {formatDateTime(item.nextAttemptAt)}
                      </Td>
                      <Td>
                        <p className="max-w-[30ch] text-[12px] leading-relaxed text-muted">
                          {item.lastError ?? '—'}
                        </p>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            {cursor ? (
              <div className="px-5 py-4 text-center">
                <Button
                  variant="secondary"
                  loading={loadingMore}
                  onClick={() => void fetchPage(cursor, false)}
                >
                  Load older deliveries
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<IconSpark className="h-5 w-5" />}
            title="No deliveries"
            description="Notifications appear here once invitations, alerts, or receipts are queued."
          />
        )}
        <div className="border-t border-line px-5 py-3">
          <InlineNotice>
            Retries are audited. Provider credentials are never exposed in this console; configure them through
            environment variables.
          </InlineNotice>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={retry}
        title="Retry selected deliveries?"
        description={`${selectedRetryable.length} ${selectedRetryable.length === 1 ? 'delivery' : 'deliveries'} will be requeued with a fresh attempt counter.`}
        confirmLabel="Requeue"
        busy={busy}
      >
        {retryError ? <InlineError>{retryError}</InlineError> : null}
      </ConfirmDialog>

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
            void retry();
          }
        }}
      />
    </>
  );
}
