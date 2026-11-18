'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AlertSummary, Page } from '../../../contracts/index';
import { alertStateBadge } from '@/components/status';
import { IconAlert, IconBell, IconChevronRight, IconRefresh } from '@/components/icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Tabs,
  useFlash,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/format';

type Filter = 'ALL' | 'UNREAD' | 'READ' | 'REVIEWED';

export default function AlertsPage() {
  const { request } = useAuth();
  const flash = useFlash();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [items, setItems] = useState<AlertSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (filter !== 'ALL') params.set('state', filter);
        if (nextCursor) params.set('cursor', nextCursor);
        const page = await request<Page<AlertSummary>>(`/api/v1/alerts?${params.toString()}`);
        setItems((current) => (replace ? page.items : [...current, ...page.items]));
        setCursor(page.nextCursor);
      } catch (cause) {
        setError(cause);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, request],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void fetchPage(null, true);
  }, [fetchPage]);

  const counts = {
    unread: items.filter((item) => item.state === 'UNREAD').length,
    read: items.filter((item) => item.state === 'READ').length,
    reviewed: items.filter((item) => item.state === 'REVIEWED').length,
  };

  return (
    <div>
      <PageHeader
        title="Departure alerts"
        description="A departure alert is raised when a clocked-in staff member's qualified location stays outside the site for the grace period. Every alert keeps its evidence."
        actions={
          <Button
            variant="secondary"
            icon={<IconRefresh className="h-4 w-4" />}
            onClick={() => {
              void fetchPage(null, true);
              flash('Alerts refreshed.');
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'ALL', label: 'All' },
            { value: 'UNREAD', label: 'Unread', count: counts.unread || undefined },
            { value: 'READ', label: 'Read' },
            { value: 'REVIEWED', label: 'Reviewed' },
          ]}
        />
        <p className="text-[12px] text-muted">Newest first · the list shows the last loaded page range.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={errorMessage(error, 'Alerts could not be loaded.')}
          onRetry={() => void fetchPage(null, true)}
        />
      ) : items.length ? (
        <div className="space-y-2.5">
          {items.map((alert) => (
            <Link
              key={alert.id}
              href={`/alerts/${alert.id}`}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
            >
              <Card
                className={
                  alert.state === 'UNREAD'
                    ? 'border-[#f6ddb8] bg-[#fffdf9] transition-colors hover:border-[#eccb96]'
                    : 'transition-colors hover:border-[#c9d5ea]'
                }
              >
                <div className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
                  <span
                    className={
                      alert.state === 'UNREAD'
                        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn'
                        : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted'
                    }
                  >
                    <IconAlert className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[13.5px] font-semibold text-ink">{alert.workerName}</p>
                      <span className="text-[12px] text-muted">left</span>
                      <p className="text-[13px] text-ink">{alert.siteName}</p>
                      {alert.stillWorking ? <Badge tone="slate">Still clocked in</Badge> : null}
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      Detected {formatDateTime(alert.detectedAt)} · {relativeTime(alert.detectedAt)}
                      {alert.lastUpdateAt ? ` · updated ${relativeTime(alert.lastUpdateAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {alertStateBadge(alert.state)}
                    <IconChevronRight className="h-4 w-4 text-[#b4bdcc]" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {cursor ? (
            <div className="pt-2 text-center">
              <Button variant="secondary" loading={loadingMore} onClick={() => void fetchPage(cursor, false)}>
                Load older alerts
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconBell className="h-5 w-5" />}
            title={filter === 'ALL' ? 'No departure alerts' : 'Nothing in this state'}
            description={
              filter === 'ALL'
                ? 'Alerts appear here when a clocked-in staff member stays outside the site radius past the grace period. An empty list is good news.'
                : 'Switch tabs to see other alerts, or check back after the next location sync.'
            }
          />
        </Card>
      )}
    </div>
  );
}
