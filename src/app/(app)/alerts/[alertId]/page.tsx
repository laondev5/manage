'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { AlertDetail } from '../../../../contracts/index';
import { alertStateBadge } from '@/components/status';
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconInfo,
  IconPin,
  IconUsers,
} from '@/components/icons';
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorState,
  Field,
  InlineError,
  InlineNotice,
  PageHeader,
  Skeleton,
  Textarea,
  cn,
  useFlash,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { hasCapability, useAuth } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const DECISIONS = [
  {
    value: 'ACKNOWLEDGED' as const,
    label: 'Acknowledged',
    hint: 'Seen and noted. No further action for now.',
  },
  {
    value: 'CONTACTED' as const,
    label: 'Contacted staff',
    hint: 'Someone reached the staff member about the departure.',
  },
  {
    value: 'DISMISSED' as const,
    label: 'Dismissed as expected',
    hint: 'The staff member was away for a legitimate reason.',
  },
];

export default function AlertDetailPage() {
  const params = useParams<{ alertId: string }>();
  const alertId = typeof params.alertId === 'string' ? params.alertId : '';
  const { me } = useAuth();
  const { data, error, loading, reload, setData } = useApiData<AlertDetail>(
    alertId ? `/api/v1/alerts/${alertId}` : null,
  );

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: 'Alerts', href: '/alerts' }, { label: 'Alert' }]} />
        <ErrorState
          title="This alert could not be opened"
          message={errorMessage(error, 'The alert may no longer be available to your account.')}
          onRetry={reload}
        />
      </div>
    );
  }

  const alert = data;
  const canReview = hasCapability(me, 'owner.alerts') && alert.state !== 'REVIEWED';
  const beyond =
    alert.distanceMeters !== null && alert.distanceMeters > alert.radiusMeters
      ? alert.distanceMeters - alert.radiusMeters
      : null;

  return (
    <div>
      <div className="mb-2">
        <Breadcrumb items={[{ label: 'Alerts', href: '/alerts' }, { label: alert.workerName }]} />
      </div>
      <PageHeader
        title={`${alert.workerName} left ${alert.siteName}`}
        description={`Detected ${formatDateTime(alert.detectedAt)} · ${relativeTime(alert.detectedAt)}`}
        actions={<>{alertStateBadge(alert.state)}</>}
      />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="What the system saw"
              description="Presence is a separate signal from attendance. This alert does not change the shift record."
            />
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-warn/[0.35] bg-warn-soft/60 p-3.5">
                <div className="flex items-start gap-2.5">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  <p className="text-[13px] leading-relaxed text-[#6b3d07]">{alert.explanation}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Distance from centre" value={alert.distanceMeters !== null ? `${Math.round(alert.distanceMeters)} m` : '—'} />
                <Metric label="Site radius" value={`${alert.radiusMeters} m`} />
                <Metric
                  label="Beyond radius"
                  value={beyond !== null ? `${Math.round(beyond)} m` : 'Within buffer'}
                  tone={beyond !== null ? 'warn' : 'default'}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
                  <span>Distance vs radius</span>
                  <span className="tabular">
                    {alert.distanceMeters !== null ? `${Math.round(alert.distanceMeters)} / ${alert.radiusMeters} m` : 'No reading'}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-[#eef1f6]">
                  {alert.distanceMeters !== null ? (
                    <div
                      className={cn(
                        'h-full rounded-full',
                        beyond !== null ? 'bg-warn' : 'bg-cobalt',
                      )}
                      style={{
                        width: `${Math.min(100, Math.round((alert.distanceMeters / (alert.radiusMeters * 2)) * 100))}%`,
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-navy/60"
                    style={{ left: '50%' }}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted">The dark marker is the site radius.</p>
              </div>

              <dl className="grid gap-3 border-t border-line pt-3.5 sm:grid-cols-2">
                <Detail label="Detection point">
                  {alert.detectionLatitude !== null && alert.detectionLongitude !== null
                    ? `${alert.detectionLatitude.toFixed(5)}, ${alert.detectionLongitude.toFixed(5)}`
                    : 'No coordinates recorded'}
                </Detail>
                <Detail label="Accuracy">
                  {alert.detectionAccuracyMeters !== null
                    ? `± ${Math.round(alert.detectionAccuracyMeters)} m`
                    : '—'}
                </Detail>
                <Detail label="Shift started">{formatDateTime(alert.shiftStartedAt)}</Detail>
                <Detail label="Still working">
                  {alert.stillWorking ? 'Yes, clocked in when detected' : 'Shift had ended'}
                </Detail>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Server-recorded progression of this incident." />
            <ol className="px-5 py-4">
              {alert.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < alert.events.length - 1 ? (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden="true" />
                  ) : null}
                  <span className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-white bg-cobalt shadow-[0_0_0_1px_#cdd9ef]" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{event.label}</p>
                    <p className="text-[11.5px] text-muted">{formatDateTime(event.at)}</p>
                    {event.detail ? (
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{event.detail}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="People and place" />
            <div className="space-y-3 p-5">
              <PersonRow icon={<IconUsers className="h-4 w-4" />} label="Staff member" value={alert.workerName} />
              <PersonRow icon={<IconPin className="h-4 w-4" />} label="Site" value={alert.siteName} />
              <PersonRow
                icon={<IconClock className="h-4 w-4" />}
                label="Detected"
                value={formatDateTime(alert.detectedAt)}
              />
              <PersonRow
                icon={<IconInfo className="h-4 w-4" />}
                label="Received by server"
                value={`${formatDateTime(alert.receivedAt)} (${relativeTime(alert.receivedAt)})`}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title={alert.review ? 'Review' : 'Review this alert'}
              description={alert.review ? undefined : 'Record what you did so the trail is clear.'}
            />
            <div className="p-5">
              {alert.review ? (
                <div className="space-y-3">
                  <Badge tone="blue">{reviewLabel(alert.review.decision)}</Badge>
                  <div className="text-[12.5px] text-muted">
                    <p className="text-ink">{alert.review.reviewedBy}</p>
                    <p>{formatDateTime(alert.review.reviewedAt)}</p>
                  </div>
                  {alert.review.note ? (
                    <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink">
                      {alert.review.note}
                    </p>
                  ) : null}
                </div>
              ) : canReview ? (
                <ReviewForm alert={alert} onReviewed={(next) => setData(next)} />
              ) : (
                <InlineNotice tone="warn">
                  Your role can view this alert but not record a review. Ask a site owner to review it.
                </InlineNotice>
              )}
            </div>
          </Card>

          <ButtonLink href="/alerts" variant="ghost" size="sm" icon={<IconArrowLeft className="h-4 w-4" />}>
            Back to alerts
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function reviewLabel(decision: string) {
  if (decision === 'ACKNOWLEDGED') return 'Acknowledged';
  if (decision === 'CONTACTED') return 'Staff contacted';
  return 'Dismissed as expected';
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="rounded-lg border border-line bg-[#fafbfe] px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn('mt-1 text-[16px] font-semibold tabular', tone === 'warn' ? 'text-warn' : 'text-ink')}>
        {value}
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function PersonRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11.5px] text-muted">{label}</p>
        <p className="text-[13px] text-ink">{value}</p>
      </div>
    </div>
  );
}

function ReviewForm({ alert, onReviewed }: { alert: AlertDetail; onReviewed: (next: AlertDetail) => void }) {
  const { request } = useAuth();
  const flash = useFlash();
  const [decision, setDecision] = useState<'ACKNOWLEDGED' | 'CONTACTED' | 'DISMISSED'>('ACKNOWLEDGED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await request<AlertDetail>(`/api/v1/alerts/${alert.id}/review`, {
        method: 'POST',
        body: { decision, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      onReviewed(result);
      flash('Alert review recorded.');
    } catch (cause) {
      setError(errorMessage(cause, 'The review could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      {error ? <InlineError>{error}</InlineError> : null}
      <div className="space-y-2">
        {DECISIONS.map((option) => {
          const active = decision === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                active ? 'border-cobalt bg-[#f4f7fe]' : 'border-line hover:border-[#c6d0e2]',
              )}
            >
              <input
                type="radio"
                name="decision"
                value={option.value}
                checked={active}
                onChange={() => setDecision(option.value)}
                className="mt-0.5 h-4 w-4 text-cobalt focus:ring-cobalt"
              />
              <span>
                <span className="block text-[13px] font-medium text-ink">{option.label}</span>
                <span className="block text-[11.5px] leading-snug text-muted">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <Field label="Note" htmlFor="review-note" optional hint="Up to 500 characters. Visible in the audit trail.">
        <Textarea
          id="review-note"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Called the site supervisor; staff member was at the bank for a delivery."
        />
      </Field>
      <Button type="submit" block loading={busy} icon={<IconCheck className="h-4 w-4" />}>
        Record review
      </Button>
      <p className="text-[11.5px] leading-relaxed text-muted">
        Reviewing does not change clock-in or clock-out times. Corrections are a separate request the staff
        member raises and you decide.
      </p>
    </form>
  );
}
