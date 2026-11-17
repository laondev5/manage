import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CorrectionDetail } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDateTime, relativeTime } from '@/lib/format';
import { correctionBadge } from '@/components/status';
import {
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
import { IconAlert, IconCheck, IconInfo, IconX } from '@/components/icons';

type Decision = 'APPROVE' | 'REJECT';

export default function CorrectionDetailScreen() {
  const router = useRouter();
  const { hasCapability, me } = useAuth();
  const { correctionId } = useLocalSearchParams<{ correctionId: string }>();
  const id = typeof correctionId === 'string' ? correctionId : '';
  const resource = useApiResource<CorrectionDetail>(() => api.correction(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!hasCapability('owner.corrections')) {
    return (
      <Screen>
        <Header title="Correction" onBack={() => router.back()} />
        <View className="p-4">
          <Card>
            <EmptyState
              icon={<IconAlert size={20} />}
              title="Corrections are for site owners"
              body="Your account cannot decide correction requests."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Correction" onBack={() => router.back()} />
        <Loading label="Loading the request" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Correction" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const correction = resource.data;
  if (!correction) return null;
  const ownRequest = me?.user.id === correction.workerId;
  const pending = correction.status === 'PENDING';

  const decide = async (decision: Decision) => {
    setBusy(decision);
    setActionError(null);
    setSaved(null);
    try {
      const updated = await api.decideCorrection(correction.id, {
        decision,
        expectedVersion: correction.version,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      resource.setData(updated);
      setNote('');
      setSaved(decision === 'APPROVE' ? 'Correction approved.' : 'Correction rejected.');
    } catch (cause) {
      setActionError(messageOf(cause, 'The decision could not be saved.'));
      resource.reload();
    } finally {
      setBusy(null);
    }
  };

  const confirm = (decision: Decision) => {
    Alert.alert(
      decision === 'APPROVE' ? 'Approve this correction?' : 'Reject this correction?',
      decision === 'APPROVE'
        ? 'The shift will use the proposed times. The original values stay in the audit trail.'
        : 'The shift keeps its recorded times. The staff member can see the decision and your note.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision === 'APPROVE' ? 'Approve' : 'Reject',
          style: decision === 'APPROVE' ? 'default' : 'destructive',
          onPress: () => void decide(decision),
        },
      ],
    );
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Correction"
        title={correction.workerName}
        subtitle={`${correction.siteName} · requested ${relativeTime(correction.requestedAt)}`}
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {actionError ? <ErrorNote message={actionError} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="p-5">
          <View className="flex-row items-start gap-3">
            <IconTile tone="blue">
              <IconAlert size={18} color="#2457D6" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[12.5px] leading-5 text-muted">
                {correction.workerName} asked to amend a recorded shift at {correction.siteName}.
              </Text>
              <View className="mt-2">{correctionBadge(correction.status)}</View>
            </View>
          </View>
        </Card>

        <SectionTitle>Times</SectionTitle>
        <Card className="p-5">
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-[16px] bg-[#F1F5FB] px-3.5 py-3">
              <Text className="text-[10.5px] font-bold uppercase tracking-[1px] text-faint">Recorded</Text>
              <Text className="mt-1.5 text-[12.5px] font-semibold text-ink">
                {formatDateTime(correction.originalStartAt)}
              </Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                {correction.originalEndAt ? formatDateTime(correction.originalEndAt) : 'Still working'}
              </Text>
            </View>
            <View className="flex-1 rounded-[16px] bg-cobalt-soft px-3.5 py-3">
              <Text className="text-[10.5px] font-bold uppercase tracking-[1px] text-cobalt">Proposed</Text>
              <Text className="mt-1.5 text-[12.5px] font-semibold text-ink">
                {formatDateTime(correction.proposedStartAt)}
              </Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                {correction.proposedEndAt ? formatDateTime(correction.proposedEndAt) : 'Open (clock-out missing)'}
              </Text>
            </View>
          </View>
          <Text className="mt-3 text-[11px] leading-4 text-faint">
            Times are shown in this device&apos;s timezone. The shift records keep the site timezone.
          </Text>
        </Card>

        <SectionTitle>Reason</SectionTitle>
        <Card className="p-4">
          <Text className="text-[13px] leading-5 text-ink">{correction.reason}</Text>
          {correction.requestNote ? (
            <Text className="mt-2 text-[12px] leading-5 text-muted">Note: {correction.requestNote}</Text>
          ) : null}
        </Card>

        {pending ? (
          ownRequest ? (
            <View className="mt-4">
              <Notice tone="warn">
                You cannot approve or reject your own correction request. Another site owner or a platform
                administrator must decide it.
              </Notice>
            </View>
          ) : (
            <>
              <SectionTitle>Decision</SectionTitle>
              <Card className="p-4">
                <Field label="Reviewer note" hint="Shared with the staff member. Optional." optional>
                  <Input
                    value={note}
                    onChangeText={setNote}
                    placeholder="Matched the paper timesheet…"
                    multiline
                    maxLength={500}
                    style={{ height: 88, textAlignVertical: 'top', paddingTop: 12 }}
                  />
                </Field>
                <View className="gap-2">
                  <Button
                    label="Approve correction"
                    onPress={() => confirm('APPROVE')}
                    loading={busy === 'APPROVE'}
                    disabled={busy !== null}
                    icon={<IconCheck size={16} color="#FFFFFF" />}
                  />
                  <Button
                    label="Reject correction"
                    variant="danger"
                    onPress={() => confirm('REJECT')}
                    loading={busy === 'REJECT'}
                    disabled={busy !== null}
                    icon={<IconX size={16} color="#B42318" />}
                  />
                </View>
                <Text className="mt-3 text-[11px] leading-4 text-faint">
                  Requests are versioned. If another reviewer decides first, this screen refreshes with their
                  decision instead of overwriting it.
                </Text>
              </Card>
            </>
          )
        ) : (
          <>
            <SectionTitle>Outcome</SectionTitle>
            <Card className="p-4">
              <KeyValue label="Decision" value={correction.status === 'APPROVED' ? 'Approved' : 'Rejected'} />
              <Divider />
              <KeyValue label="Reviewed by" value={correction.reviewerName ?? '—'} />
              <Divider />
              <KeyValue
                label="Reviewed"
                value={correction.reviewedAt ? formatDateTime(correction.reviewedAt) : '—'}
              />
              {correction.reviewerNote ? (
                <>
                  <Divider />
                  <KeyValue label="Note" value={correction.reviewerNote} />
                </>
              ) : null}
            </Card>
          </>
        )}

        <SectionTitle>Audit trail</SectionTitle>
        <Card className="p-4">
          {correction.auditTrail.length ? (
            correction.auditTrail.map((entry, index) => (
              <View key={`${entry.at}-${index}`} className="flex-row gap-3">
                <View className="items-center">
                  <View className="mt-1 h-2.5 w-2.5 rounded-full bg-navy" />
                  {index < correction.auditTrail.length - 1 ? (
                    <View className="my-1 w-px flex-1 bg-line" />
                  ) : null}
                </View>
                <View className={`flex-1 ${index < correction.auditTrail.length - 1 ? 'pb-4' : ''}`}>
                  <Text className="text-[13px] font-semibold text-ink">{entry.action}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-muted">
                    {entry.actorName ?? 'System'} · {formatDateTime(entry.at)}
                  </Text>
                  {entry.detail ? (
                    <Text className="mt-1 text-[12px] leading-4 text-muted">{entry.detail}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View className="flex-row items-start gap-2">
              <IconInfo size={14} />
              <Text className="flex-1 text-[12px] leading-4 text-muted">
                No audit entries were returned for this request.
              </Text>
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}
