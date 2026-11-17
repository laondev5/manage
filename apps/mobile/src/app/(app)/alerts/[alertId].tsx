import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AlertDetail, AlertReview } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDateTime, relativeTime } from '@/lib/format';
import { alertStateBadge } from '@/components/status';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorNote,
  Field,
  Header,
  IconTile,
  Input,
  KeyValue,
  Loading,
  Notice,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { IconAlert, IconBell, IconBuilding, IconCheck, IconInfo } from '@/components/icons';

const DECISION_LABEL: Record<AlertReview['decision'], string> = {
  ACKNOWLEDGED: 'Acknowledged',
  CONTACTED: 'Contacted',
  DISMISSED: 'Dismissed',
};

export default function AlertDetailScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const { alertId } = useLocalSearchParams<{ alertId: string }>();
  const id = typeof alertId === 'string' ? alertId : '';
  const resource = useApiResource<AlertDetail>(() => api.alert(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<AlertReview['decision'] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!hasCapability('owner.alerts')) {
    return (
      <Screen>
        <Header title="Alert" onBack={() => router.back()} />
        <View className="p-4">
          <Card>
            <EmptyState
              icon={<IconBell size={20} />}
              title="Alerts are for site owners"
              body="Your account cannot review departure alerts."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Alert" onBack={() => router.back()} />
        <Loading label="Loading the evidence" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Alert" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const alert = resource.data;
  if (!alert) return null;
  const reviewed = alert.state === 'REVIEWED' || alert.review !== null;

  const review = async (decision: AlertReview['decision']) => {
    setBusy(decision);
    setActionError(null);
    setSaved(null);
    try {
      const updated = await api.reviewAlert(alert.id, {
        decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      resource.setData(updated);
      setNote('');
      setSaved(`Marked as ${DECISION_LABEL[decision].toLowerCase()}.`);
    } catch (cause) {
      setActionError(messageOf(cause, 'The alert could not be updated.'));
    } finally {
      setBusy(null);
    }
  };

  const confirm = (decision: AlertReview['decision']) => {
    const label = DECISION_LABEL[decision].toLowerCase();
    Alert.alert(
      `Mark this alert as ${label}?`,
      decision === 'DISMISSED'
        ? 'Dismissing closes the alert without contacting the staff member. The evidence stays in the audit trail.'
        : 'The decision and your note are recorded with your name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: DECISION_LABEL[decision],
          style: decision === 'DISMISSED' ? 'destructive' : 'default',
          onPress: () => void review(decision),
        },
      ],
    );
  };

  const accuracy =
    alert.detectionAccuracyMeters === null ? '—' : `±${Math.round(alert.detectionAccuracyMeters)} m`;
  const distance =
    alert.distanceMeters === null ? '—' : `${Math.round(alert.distanceMeters)} m from the site centre`;

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Alert evidence"
        title="Departure alert"
        subtitle={`${alert.workerName} · ${alert.siteName}`}
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {actionError ? <ErrorNote message={actionError} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="bg-amber-soft p-5">
          <View className="flex-row items-start gap-3">
            <IconTile tone="amber">
              <IconAlert size={18} color="#B54708" />
            </IconTile>
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-1.5">
                {alertStateBadge(alert.state)}
                {alert.stillWorking ? (
                  <Badge tone="amber">Still clocked in</Badge>
                ) : (
                  <Badge tone="slate">Clocked out</Badge>
                )}
              </View>
              <Text className="mt-2 text-[14px] font-semibold leading-5 text-ink">{alert.explanation}</Text>
              <Text className="mt-1.5 text-[11.5px] text-muted">
                Detected {relativeTime(alert.detectedAt)} · received {relativeTime(alert.receivedAt)}
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Evidence</SectionTitle>
        <Card className="px-4">
          <KeyValue label="Last distance" value={distance} />
          <Divider />
          <KeyValue label="Site radius" value={`${alert.radiusMeters} m`} />
          <Divider />
          <KeyValue label="GPS accuracy" value={accuracy} />
          <Divider />
          <KeyValue label="Shift started" value={formatDateTime(alert.shiftStartedAt)} />
          <Divider />
          <KeyValue label="Detected" value={formatDateTime(alert.detectedAt)} />
          {alert.lastUpdateAt ? (
            <>
              <Divider />
              <KeyValue label="Last location update" value={formatDateTime(alert.lastUpdateAt)} />
            </>
          ) : null}
        </Card>

        {alert.detectionLatitude !== null && alert.detectionLongitude !== null ? (
          <View className="mt-3 flex-row items-start gap-2 rounded-xl border border-line bg-white px-3.5 py-3">
            <IconInfo size={14} />
            <Text className="flex-1 text-[11.5px] leading-4 text-muted">
              Last detected position: {alert.detectionLatitude.toFixed(5)}, {alert.detectionLongitude.toFixed(5)}.
              Location history is retained for the configured window and is only used for attendance oversight.
            </Text>
          </View>
        ) : null}

        <SectionTitle>Timeline</SectionTitle>
        <Card className="p-4">
          {alert.events.length ? (
            alert.events.map((event, index) => (
              <View key={`${event.at}-${index}`} className="flex-row gap-3">
                <View className="items-center">
                  <View className="mt-1 h-2.5 w-2.5 rounded-full bg-cobalt" />
                  {index < alert.events.length - 1 ? <View className="my-1 w-px flex-1 bg-line" /> : null}
                </View>
                <View className={`flex-1 ${index < alert.events.length - 1 ? 'pb-4' : ''}`}>
                  <Text className="text-[13px] font-semibold text-ink">{event.label}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-muted">{formatDateTime(event.at)}</Text>
                  {event.detail ? <Text className="mt-1 text-[12px] leading-4 text-muted">{event.detail}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text className="text-[12.5px] text-muted">No timeline entries were recorded for this alert.</Text>
          )}
        </Card>

        <SectionTitle>Decision</SectionTitle>
        {reviewed && alert.review ? (
          <Card className="p-4">
            <View className="flex-row items-center gap-2">
              <IconCheck size={16} color="#2457D6" />
              <Text className="text-[14px] font-semibold text-ink">
                {DECISION_LABEL[alert.review.decision]}
              </Text>
            </View>
            <Text className="mt-1 text-[11.5px] text-muted">
              {alert.review.reviewedBy} · {formatDateTime(alert.review.reviewedAt)}
            </Text>
            {alert.review.note ? (
              <Text className="mt-3 text-[12.5px] leading-5 text-muted">{alert.review.note}</Text>
            ) : null}
          </Card>
        ) : (
          <Card className="p-4">
            <Field label="Note" hint="Optional. Record what you found or who you spoke to." optional>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Called the site supervisor…"
                multiline
                maxLength={500}
                style={{ height: 92, textAlignVertical: 'top', paddingTop: 12 }}
              />
            </Field>
            <View className="gap-2">
              <Button
                label="Acknowledge"
                onPress={() => confirm('ACKNOWLEDGED')}
                loading={busy === 'ACKNOWLEDGED'}
                disabled={busy !== null}
              />
              <Button
                label="Mark as contacted"
                variant="secondary"
                onPress={() => confirm('CONTACTED')}
                loading={busy === 'CONTACTED'}
                disabled={busy !== null}
              />
              <Button
                label="Dismiss alert"
                variant="danger"
                onPress={() => confirm('DISMISSED')}
                loading={busy === 'DISMISSED'}
                disabled={busy !== null}
              />
            </View>
            <Text className="mt-3 text-[11px] leading-4 text-faint">
              Dismiss does not contact the staff member. Every decision is written to the hash-chained audit
              trail with your name.
            </Text>
          </Card>
        )}

        <View className="mt-4">
          <Pressable
            onPress={() => router.push(`/sites/${alert.siteId}`)}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-line-strong bg-white py-3"
          >
            <IconBuilding size={15} />
            <Text className="text-[13px] font-semibold text-ink">Open {alert.siteName}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
