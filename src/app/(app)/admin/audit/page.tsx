'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditEvent, OrganizationSummary, Page } from '../../../../contracts/index';
import { RequireAdmin } from '@/components/app-shell';
import { IconRefresh, IconScroll } from '@/components/icons';
import {
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
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysAgoInput, formatDateTime, localDateInput, toIsoRangeEnd, toIsoRangeStart } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const COMMON_ACTIONS = [
  'alert.reviewed',
  'assignment.created',
  'assignment.ended',
  'correction.requested',
  'delivery.retried',
  'export.created',
  'grant.created',
  'grant.revoked',
  'invitation.accepted',
  'invitation.created',
  'invitation.sent',
  'membership.updated',
  'organization.created',
  'organization.updated',
  'site.created',
  'site.updated',
  'site.policy_updated',
];

type AppliedFilters = {
  action: string;
  organizationId: string;
  from: string;
  to: string;
};

export default function AdminAuditPage() {
  return (
    <RequireAdmin>
      <AuditContent />
    </RequireAdmin>
  );
}

function AuditContent() {
  const { request } = useAuth();
  const orgs = useApiData<OrganizationSummary[]>('/api/v1/admin/organizations');
  const [draft, setDraft] = useState<AppliedFilters>({
    action: '',
    organizationId: '',
    from: daysAgoInput(7),
    to: localDateInput(),
  });
  const [applied, setApplied] = useState<AppliedFilters>({
    action: '',
    organizationId: '',
    from: daysAgoInput(7),
    to: localDateInput(),
  });
  const [items, setItems] = useState<AuditEvent[]>([]);
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
        if (applied.action.trim()) params.set('action', applied.action.trim());
        if (applied.organizationId) params.set('organizationId', applied.organizationId);
        if (applied.from) params.set('from', toIsoRangeStart(applied.from));
        if (applied.to) params.set('to', toIsoRangeEnd(applied.to));
        if (nextCursor) params.set('cursor', nextCursor);
        const page = await request<Page<AuditEvent>>(`/api/v1/admin/audit?${params.toString()}`);
        setItems((current) => (replace ? page.items : [...current, ...page.items]));
        setCursor(page.nextCursor);
      } catch (cause) {
        setError(cause);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [applied, request],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void fetchPage(null, true);
  }, [fetchPage]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const from = draft.from;
    const to = draft.to;
    setApplied({
      action: draft.action,
      organizationId: draft.organizationId,
      from: from && to && from > to ? to : from,
      to: from && to && from > to ? from : to,
    });
  };

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only, hash-chained record of administrative and operational actions. Each entry commits to the entry before it."
        actions={
          <Button
            variant="secondary"
            icon={<IconRefresh className="h-4 w-4" />}
            onClick={() => void fetchPage(null, true)}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader title="Filters" description="Narrow by action, organization, or date. Times are your local browser dates." />
        <form onSubmit={apply} className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Action" htmlFor="audit-action">
            <Input
              id="audit-action"
              list="audit-actions"
              value={draft.action}
              placeholder="All actions"
              onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))}
            />
            <datalist id="audit-actions">
              {COMMON_ACTIONS.map((action) => (
                <option key={action} value={action} />
              ))}
            </datalist>
          </Field>
          <Field label="Organization" htmlFor="audit-org">
            <Select
              id="audit-org"
              value={draft.organizationId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, organizationId: event.target.value }))
              }
            >
              <option value="">All organizations</option>
              {(orgs.data ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              value={draft.from}
              max={draft.to}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              value={draft.to}
              min={draft.from}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="w-full" loading={loading}>
              Apply
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const reset = {
                  action: '',
                  organizationId: '',
                  from: daysAgoInput(7),
                  to: localDateInput(),
                };
                setDraft(reset);
                setApplied(reset);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Events" description={`${items.length} loaded`} />
        {loading && !items.length ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message={errorMessage(error, 'Audit events could not be loaded.')}
            onRetry={() => void fetchPage(null, true)}
          />
        ) : items.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Summary</Th>
                  <Th>Chain</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-[#fafbfe]">
                    <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(event.at)}</Td>
                    <Td>
                      <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11.5px]">
                        {event.action}
                      </code>
                      <p className="mt-1 text-[11px] text-muted">
                        {event.targetType}
                        {event.targetId ? ` · ${event.targetId.slice(-6)}` : ''}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-[12.5px] text-ink">{event.actorName ?? 'System'}</p>
                      <p className="text-[11px] text-muted">{event.actorRole ?? '—'}</p>
                    </Td>
                    <Td>
                      <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-ink">{event.summary}</p>
                      {event.requestId ? (
                        <p className="mt-1 font-mono text-[10.5px] text-muted">req {event.requestId}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <p
                        className="font-mono text-[10.5px] text-muted"
                        title={`previous: ${event.previousHash ?? 'genesis'}`}
                      >
                        {event.hash.slice(0, 12)}…
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[#a3aec0]">
                        prev {event.previousHash ? `${event.previousHash.slice(0, 8)}…` : 'genesis'}
                      </p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {cursor ? (
              <div className="px-5 py-4 text-center">
                <Button variant="secondary" loading={loadingMore} onClick={() => void fetchPage(cursor, false)}>
                  Load older events
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<IconScroll className="h-5 w-5" />}
            title="No events in this range"
            description="Widen the dates or clear the action filter. Audit entries are written for every sensitive action, including grant and policy changes."
          />
        )}
        <div className="border-t border-line px-5 py-3">
          <InlineNotice>
            An entry that fails the hash chain is evidence of tampering. If you suspect a gap, compare the
            previous hash shown here with the hash of the entry above it.
          </InlineNotice>
        </div>
      </Card>
    </div>
  );
}
