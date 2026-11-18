'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Page, SiteSummary, TimesheetRow } from '../../../contracts/index';
import { RequireCapability } from '@/components/app-shell';
import { reviewBadge } from '@/components/status';
import { IconClock, IconDownload, IconRefresh } from '@/components/icons';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  Input,
  PageHeader,
  Select,
  Skeleton,
  TableWrap,
  Td,
  Th,
  useFlash,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  daysAgoInput,
  formatDateTime,
  humanDuration,
  localDateInput,
  toIsoRangeEnd,
  toIsoRangeStart,
} from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

export default function TimesheetsPage() {
  return (
    <RequireCapability
      capability="owner.exports"
      title="Timesheets are for site owners"
      message="Your account can view its own shift history in the mobile app, but not organization timesheets."
    >
      <TimesheetsContent />
    </RequireCapability>
  );
}

function TimesheetsContent() {
  const { request, activeOrgId } = useAuth();
  const flash = useFlash();
  const sites = useApiData<SiteSummary[]>('/api/v1/sites');
  const [from, setFrom] = useState(() => daysAgoInput(6));
  const [to, setTo] = useState(() => localDateInput());
  const [siteId, setSiteId] = useState('ALL');
  const [items, setItems] = useState<TimesheetRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeInvalid = !from || !to || from > to;

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (rangeInvalid) {
        setItems([]);
        setCursor(null);
        setLoading(false);
        return;
      }
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          from: toIsoRangeStart(from),
          to: toIsoRangeEnd(to),
          limit: '100',
        });
        if (siteId !== 'ALL') params.set('siteId', siteId);
        if (nextCursor) params.set('cursor', nextCursor);
        const page = await request<Page<TimesheetRow>>(`/api/v1/timesheets?${params.toString()}`);
        setItems((current) => (replace ? page.items : [...current, ...page.items]));
        setCursor(page.nextCursor);
      } catch (cause) {
        setError(cause);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [from, to, siteId, request, rangeInvalid],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void fetchPage(null, true);
  }, [fetchPage]);

  const totals = useMemo(() => {
    const minutes = items.reduce((sum, row) => sum + (row.minutes ?? 0), 0);
    const needsReview = items.filter((row) => row.reviewState !== 'ACCEPTED').length;
    return { minutes, needsReview };
  }, [items]);

  const exportCsv = async () => {
    if (!activeOrgId) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await request<{ filename: string; rowCount: number; csv: string }>('/api/v1/exports', {
        method: 'POST',
        body: {
          organizationId: activeOrgId,
          ...(siteId !== 'ALL' ? { siteId } : {}),
          from: toIsoRangeStart(from),
          to: toIsoRangeEnd(to),
        },
      });
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      flash(`Exported ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}.`);
    } catch (cause) {
      setExportError(errorMessage(cause, 'The export could not be generated.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description="Completed and active shifts for the selected range. Reviewed corrections appear in the shift record; this table never rewrites history."
        actions={
          <Button
            onClick={exportCsv}
            loading={exporting}
            disabled={!items.length || rangeInvalid || !activeOrgId}
            icon={<IconDownload className="h-4 w-4" />}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full sm:w-40">
            <Field label="From" htmlFor="ts-from">
              <Input
                id="ts-from"
                type="date"
                value={from}
                max={today()}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
          </div>
          <div className="w-full sm:w-40">
            <Field label="To" htmlFor="ts-to">
              <Input
                id="ts-to"
                type="date"
                value={to}
                max={today()}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </div>
          <div className="w-full sm:w-52">
            <Field label="Site" htmlFor="ts-site">
              <Select id="ts-site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                <option value="ALL">All sites</option>
                {(sites.data ?? []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            <QuickRange label="Today" onClick={() => setBoth(localDateInput(), localDateInput())} />
            <QuickRange label="7 days" onClick={() => setBoth(daysAgoInput(6), localDateInput())} />
            <QuickRange label="30 days" onClick={() => setBoth(daysAgoInput(29), localDateInput())} />
          </div>
          <div className="ml-auto pb-0.5">
            <Button
              variant="secondary"
              onClick={() => void fetchPage(null, true)}
              disabled={loading || rangeInvalid}
              icon={<IconRefresh className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>
        </div>
        {rangeInvalid ? (
          <div className="border-t border-line px-4 py-2.5 text-[12px] text-danger">
            Choose a start date on or before the end date.
          </div>
        ) : null}
      </Card>

      {exportError ? (
        <div className="mb-3">
          <InlineNotice tone="warn">{exportError}</InlineNotice>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title={`${items.length} shift${items.length === 1 ? '' : 's'}`}
          description={
            items.length
              ? `${humanDuration(totals.minutes)} recorded · ${totals.needsReview} needing review`
              : 'Shifts in the selected range appear here.'
          }
        />
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message={errorMessage(error, 'Timesheets could not be loaded for this range.')}
            onRetry={() => void fetchPage(null, true)}
          />
        ) : items.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Staff member</Th>
                  <Th>Site</Th>
                  <Th>Started</Th>
                  <Th>Ended</Th>
                  <Th className="text-right">Worked</Th>
                  <Th>Review</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.shiftId} className="hover:bg-[#fafbfe]">
                    <Td className="font-medium">
                      {row.workerName}
                      {row.status === 'WORKING' ? (
                        <span className="ml-2">
                          <Badge tone="blue">Active</Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td>{row.siteName}</Td>
                    <Td className="tabular">{formatInZone(row.startedAt, row.timezone)}</Td>
                    <Td className="tabular text-muted">
                      {row.endedAt ? formatInZone(row.endedAt, row.timezone) : '—'}
                    </Td>
                    <Td className="text-right tabular">{humanDuration(row.minutes)}</Td>
                    <Td>{reviewBadge(row.reviewState)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {cursor ? (
              <div className="border-t border-line px-5 py-3 text-center">
                <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void fetchPage(cursor, false)}>
                  Load more shifts
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<IconClock className="h-5 w-5" />}
            title="No shifts in this range"
            description="Try a wider range or a different site. Only shifts assigned to your organization are included."
          />
        )}
      </Card>

      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
        Exports include the attendance evidence and correction state at the time of export. The CSV is
        generated on request; nothing is emailed automatically.
      </p>
    </div>
  );

  function setBoth(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
  }
}

function today() {
  return localDateInput();
}

function formatInZone(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(value));
  } catch {
    return formatDateTime(value);
  }
}

function QuickRange({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="quiet" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}
