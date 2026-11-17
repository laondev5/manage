import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AttendanceEvent, CorrectionSummary, ShiftDetail } from '@manage/contracts';
import { ApiClientError } from '@manage/api-client';
import { api, messageOf } from '@/lib/api';
import { useApiResource } from '@/lib/hooks';
import {
  formatClock,
  formatDate,
  formatDateTime,
  fromLocalInput,
  humanDuration,
  relativeTime,
  toLocalInput,
} from '@/lib/format';
import { correctionBadge, presenceBadge, reviewBadge } from '@/components/status';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorNote,
  Field,
  Header,
  HeroCard,
  Input,
  KeyValue,
  Loading,
  Notice,
  Screen,
  SectionTitle,
  shadowSoft,
} from '@/components/ui';
import { IconCheck, IconInfo, IconPin, IconRefresh } from '@/components/icons';

const EVENT_LABEL: Record<AttendanceEvent['type'], string> = {
  CLOCK_IN: 'Clocked in',
  CLOCK_OUT: 'Clocked out',
  CLOCK_OUT_EXCEPTION: 'Clock-out exception',
  AMENDMENT: 'Amendment',
};

type DetailData = { shift: ShiftDetail; corrections: CorrectionSummary[] };

export default function ShiftDetailScreen() {
  const router = useRouter();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const id = typeof shiftId === 'string' ? shiftId : '';
  const resource = useApiResource<DetailData>(async () => {
    const [shift, corrections] = await Promise.all([
      api.shift(id),
      api
        .corrections({ scope: 'mine', limit: 100 })
        .catch(() => ({ items: [] as CorrectionSummary[], nextCursor: null })),
    ]);
    return {
      shift,
      corrections: corrections.items.filter((entry) => entry.shiftId === id),
    };
  }, [id]);

  const [reason, setReason] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [proposedEnd, setProposedEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const shift = resource.data?.shift ?? null;
  const corrections = resource.data?.corrections ?? [];
  const pendingCorrection = corrections.some((entry) => entry.status === 'PENDING');
  const prefilled = useMemo(
    () => ({
      start: shift ? toLocalInput(shift.startedAt) : '',
      end: shift?.endedAt ? toLocalInput(shift.endedAt) : '',
    }),
    [shift],
  );

  const openForm = () => {
    setProposedStart(prefilled.start);
    setProposedEnd(prefilled.end);
    setError(null);
    setDone(false);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!shift) return;
    setError(null);
    setDone(false);
    const startIso = fromLocalInput(proposedStart);
    const endIso = proposedEnd.trim() ? fromLocalInput(proposedEnd) : null;
    if (!startIso) {
      setError('Use the format YYYY-MM-DD HH:MM for the start time.');
      return;
    }
    if (proposedEnd.trim() && !endIso) {
      setError('Use the format YYYY-MM-DD HH:MM for the end time, or leave it blank.');
      return;
    }
    if (endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('The end time must be after the start time.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Explain the correction in at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.createCorrection({
        shiftId: shift.id,
        proposedStartAt: startIso,
        proposedEndAt: endIso,
        reason: reason.trim(),
      });
      setReason('');
      setFormOpen(false);
      setDone(true);
      resource.reload();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError('A correction for this shift is already waiting for your owner.');
        resource.reload();
      } else {
        setError(messageOf(cause, 'The correction request could not be sent.'));
      }
    } finally {
      setBusy(false);
    }
  };

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Shift detail" onBack={() => router.back()} />
        <Loading label="Reading the shift" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Shift detail" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  if (!shift) {
    return (
      <Screen>
        <Header title="Shift detail" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message="This shift is not available." onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Shift record"
        title="Shift detail"
        subtitle={`${shift.siteName} · ${formatDate(shift.startedAt, shift.timezone)}`}
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh shift"
            onPress={resource.refresh}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
            style={shadowSoft}
          >
            <IconRefresh size={17} color="#14213D" />
          </Pressable>
        }
      />

      <View className="px-5 pt-4">
        {done ? <Notice tone="success">Correction request sent. Your owner will review it.</Notice> : null}
        {error ? <ErrorNote message={error} /> : null}

        <HeroCard>
          <View className="px-5 pb-5 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-[1.4px] text-[#8FA3C8]">
                {shift.status === 'WORKING' ? 'In progress' : 'Completed shift'}
              </Text>
              {presenceBadge(shift.presence)}
            </View>
            <Text className="mt-2 text-[24px] font-bold tracking-[-0.4px] text-white">{shift.siteName}</Text>
            <Text className="mt-1 text-[13px] text-[#AEBBD4]">
              {formatClock(shift.startedAt, shift.timezone)} →{' '}
              {shift.endedAt ? formatClock(shift.endedAt, shift.timezone) : 'open'}
            </Text>
            <View className="mt-4 flex-row items-end justify-between">
              <View>
                <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#8FA3C8]">
                  Recorded time
                </Text>
                <Text className="mt-0.5 text-[30px] font-bold tracking-[-0.6px] text-white">
                  {shift.status === 'WORKING' ? '—' : humanDuration(shift.durationMinutes)}
                </Text>
              </View>
              <View className="items-end gap-1.5">
                {reviewBadge(shift.reviewState)}
                {shift.pendingCorrection || pendingCorrection ? <Badge tone="amber">Correction</Badge> : null}
              </View>
            </View>
          </View>

          <View className="bg-white p-5">
            <View className="flex-row items-start gap-2">
              <IconPin size={16} />
              <View className="flex-1">
                <Text className="text-[12.5px] font-semibold text-ink">{shift.siteAddress}</Text>
                <Text className="mt-0.5 text-[11.5px] text-muted">
                  {shift.timezone} · {shift.radiusMeters} m site radius
                </Text>
              </View>
            </View>
            {shift.reviewReason ? (
              <View className="mt-3 rounded-[14px] bg-amber-soft px-3.5 py-2.5">
                <Text className="text-[12px] leading-4.5 text-amber">{shift.reviewReason}</Text>
              </View>
            ) : null}
          </View>
        </HeroCard>

        {shift.receipt ? (
          <>
            <SectionTitle>Receipt</SectionTitle>
            <Card className="p-4">
              <KeyValue label="Worked" value={humanDuration(shift.receipt.workedMinutes)} />
              <Divider />
              <KeyValue
                label="Started"
                value={formatDateTime(shift.receipt.startedAt, shift.timezone)}
              />
              <KeyValue label="Ended" value={formatDateTime(shift.receipt.endedAt, shift.timezone)} />
              {shift.receipt.note ? (
                <>
                  <Divider />
                  <View className="py-2.5">
                    <Text className="text-[12.5px] text-muted">Note</Text>
                    <Text className="mt-1 text-[13px] leading-5 text-ink">{shift.receipt.note}</Text>
                  </View>
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        <SectionTitle>Presence evidence</SectionTitle>
        <Card className="p-4">
          <KeyValue label="Review state" value={reviewBadge(shift.reviewState)} />
          <Divider />
          <KeyValue label="Location checks" value={shift.observationsSummary.count} />
          <KeyValue
            label="Last accuracy"
            value={
              shift.observationsSummary.lastAccuracyMeters === null
                ? '—'
                : `±${Math.round(shift.observationsSummary.lastAccuracyMeters)} m`
            }
          />
          <KeyValue
            label="Last check"
            value={
              shift.observationsSummary.lastCapturedAt
                ? `${relativeTime(shift.observationsSummary.lastCapturedAt)} (${formatClock(
                    shift.observationsSummary.lastCapturedAt,
                    shift.timezone,
                  )})`
                : '—'
            }
          />
          <Divider />
          <KeyValue
            label="Expected hours"
            value={
              shift.expectedHours
                ? `${shift.expectedHours.start}–${shift.expectedHours.end}`
                : 'Not set'
            }
          />
        </Card>

        <SectionTitle>Event trail</SectionTitle>
        <Card className="p-4">
          {shift.events.length ? (
            <View>
              {shift.events.map((event, index) => (
                <View key={event.id} className={index > 0 ? 'mt-4 flex-row gap-3' : 'flex-row gap-3'}>
                  <View className="items-center">
                    <View
                      className={
                        event.outcome === 'ACCEPTED'
                          ? 'h-7 w-7 items-center justify-center rounded-full bg-cobalt-soft'
                          : event.outcome === 'NEEDS_REVIEW'
                            ? 'h-7 w-7 items-center justify-center rounded-full bg-amber-soft'
                            : 'h-7 w-7 items-center justify-center rounded-full bg-danger-soft'
                      }
                    >
                      <Text className="text-[11px] font-bold text-ink">{index + 1}</Text>
                    </View>
                    {index < shift.events.length - 1 ? <View className="mt-1 w-px flex-1 bg-line" /> : null}
                  </View>
                  <View className="flex-1 pb-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-[13px] font-semibold text-ink">{EVENT_LABEL[event.type]}</Text>
                      {reviewBadge(event.outcome)}
                      {event.amended ? <Badge tone="slate">Amended</Badge> : null}
                    </View>
                    <Text className="mt-1 text-[11.5px] text-muted">
                      {formatDateTime(event.capturedAt, shift.timezone)} · received{' '}
                      {relativeTime(event.receivedAt)}
                    </Text>
                    <Text className="mt-0.5 text-[11.5px] text-muted">
                      {event.distanceMeters === null ? 'No distance' : `${Math.round(event.distanceMeters)} m from site`}
                      {event.accuracyMeters === null ? '' : ` · ±${Math.round(event.accuracyMeters)} m accuracy`}
                    </Text>
                    {event.note ? (
                      <Text className="mt-1 rounded-lg bg-canvas px-2.5 py-2 text-[12px] leading-4 text-ink">
                        {event.note}
                      </Text>
                    ) : null}
                    {event.reviewReason ? (
                      <Text className="mt-1 text-[11.5px] leading-4 text-amber">{event.reviewReason}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-[12.5px] text-muted">No attendance events are attached to this shift.</Text>
          )}
        </Card>

        {corrections.length ? (
          <>
            <SectionTitle>Correction requests</SectionTitle>
            <View className="gap-2">
              {corrections.map((correction) => (
                <Card key={correction.id} className="p-4">
                  <View className="flex-row items-center justify-between">
                    {correctionBadge(correction.status)}
                    <Text className="text-[11.5px] text-muted">Asked {relativeTime(correction.requestedAt)}</Text>
                  </View>
                  <Text className="mt-2 text-[12.5px] text-ink">
                    {formatDateTime(correction.proposedStartAt)} →{' '}
                    {correction.proposedEndAt ? formatDateTime(correction.proposedEndAt) : 'open'}
                  </Text>
                  <Text className="mt-1 text-[12px] leading-4.5 text-muted">{correction.reason}</Text>
                  {correction.reviewerName ? (
                    <Text className="mt-2 text-[11.5px] text-muted">
                      {correction.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {correction.reviewerName}
                      {correction.reviewerNote ? ` · ${correction.reviewerNote}` : ''}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {shift.status === 'ENDED' && !pendingCorrection ? (
          <>
            <SectionTitle>Something wrong with these times?</SectionTitle>
            {formOpen ? (
              <Card className="p-4">
                <Field label="Corrected start" hint="Device time · YYYY-MM-DD HH:MM">
                  <Input
                    value={proposedStart}
                    onChangeText={setProposedStart}
                    placeholder="2026-11-17 08:30"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Field>
                <Field label="Corrected end" optional hint="Leave blank if the shift never ended.">
                  <Input
                    value={proposedEnd}
                    onChangeText={setProposedEnd}
                    placeholder="2026-11-17 17:30"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Field>
                <Field label="What happened?" hint="At least 10 characters. Your owner sees this.">
                  <Input
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g. The site gate was locked and I started late."
                    multiline
                    numberOfLines={3}
                    maxLength={800}
                    className={undefined}
                    style={{ height: 88, paddingTop: 12, textAlignVertical: 'top' }}
                  />
                </Field>
                <Button
                  label="Send correction request"
                  loading={busy}
                  onPress={() => void submit()}
                  disabled={busy || reason.trim().length < 10}
                />
                <Pressable onPress={() => setFormOpen(false)} className="mt-3 items-center">
                  <Text className="text-[13px] font-semibold text-muted">Cancel</Text>
                </Pressable>
              </Card>
            ) : (
              <Card className="p-4">
                <View className="flex-row items-start gap-2.5">
                  <IconInfo size={16} />
                  <View className="flex-1">
                    <Text className="text-[12.5px] leading-4.5 text-muted">
                      A correction never rewrites the original clock event. It adds a request your owner decides on,
                      and both versions stay in the record.
                    </Text>
                    <View className="mt-3">
                      <Button label="Request a correction" variant="secondary" onPress={openForm} />
                    </View>
                  </View>
                </View>
              </Card>
            )}
          </>
        ) : null}

        {shift.status === 'ENDED' && pendingCorrection ? (
          <Notice tone="warn">
            A correction for this shift is waiting for your owner. You will see the decision here.{' '}
            <Text className="font-semibold text-amber" onPress={resource.reload}>
              Refresh
            </Text>
          </Notice>
        ) : null}

        <View className="mt-5 flex-row items-center justify-center gap-1.5">
          <IconCheck size={12} color="#98A4B8" />
          <Text className="text-[11px] text-faint">
            Times shown in {shift.timezone} where the site defines one
          </Text>
        </View>
      </View>
    </Screen>
  );
}
