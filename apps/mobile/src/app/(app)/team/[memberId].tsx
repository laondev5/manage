import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TeamMemberDetail } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';
import { correctionBadge, presenceBadge } from '@/components/status';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorNote,
  Field,
  Header,
  Input,
  KeyValue,
  Loading,
  Notice,
  Screen,
  SectionTitle,
  Segmented,
  shadowSoft,
} from '@/components/ui';
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconInfo,
  IconRefresh,
  IconScroll,
  IconUsers,
  IconX,
} from '@/components/icons';

type Tab = 'overview' | 'queries';

export default function MemberDetailScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const id = typeof memberId === 'string' ? memberId : '';
  const resource = useApiResource<TeamMemberDetail>(() => api.teamMember(id), [id]);
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'query' | 'status' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!hasCapability('owner.team')) {
    return (
      <Screen>
        <Header title="Team member" onBack={() => router.back()} />
        <View className="p-4">
          <Card>
            <EmptyState
              icon={<IconUsers size={20} />}
              title="Team is for site owners"
              body="Your account cannot view other members."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Team member" onBack={() => router.back()} />
        <Loading label="Loading the member" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Team member" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const detail = resource.data;
  if (!detail) return null;
  const { member } = detail;
  const suspended = member.status === 'SUSPENDED';
  const clockedIn = detail.sites.some((site) => site.clockedInAt);

  const sendQuery = async () => {
    if (message.trim().length < 5) {
      setError('Write at least five characters.');
      return;
    }
    setBusy('query');
    setError(null);
    setSaved(null);
    try {
      const entry = await api.queryMember(member.id, { message: message.trim() });
      resource.setData({
        ...detail,
        queries: [entry, ...detail.queries],
      });
      setMessage('');
      setSaved('Query recorded on the member file.');
    } catch (cause) {
      setError(messageOf(cause, 'The query could not be recorded.'));
    } finally {
      setBusy(null);
    }
  };

  const confirmStatus = () => {
    if (reason.trim().length < 5) {
      setError('Explain the change in at least five characters.');
      return;
    }
    const next = suspended ? 'ACTIVE' : 'SUSPENDED';
    Alert.alert(
      suspended ? 'Reactivate this member?' : 'Suspend this member?',
      suspended
        ? 'The member can sign in again. Site assignments are not restored automatically — assign them to a site after reactivating.'
        : 'The member keeps their account and history, but their active site assignments end immediately so they cannot clock in. Attendance records are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: suspended ? 'Reactivate' : 'Suspend',
          style: suspended ? 'default' : 'destructive',
          onPress: async () => {
            setBusy('status');
            setError(null);
            setSaved(null);
            try {
              const updated = await api.setMemberStatus(member.id, {
                status: next,
                reason: reason.trim(),
                expectedVersion: member.membershipVersion,
              });
              resource.setData(updated);
              setReason('');
              setSaved(suspended ? 'Member reactivated.' : 'Member suspended and unassigned from sites.');
            } catch (cause) {
              setError(messageOf(cause, 'The member status could not be changed.'));
              resource.reload();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Team member"
        title={member.name}
        subtitle={member.email}
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh member"
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
        {error ? <ErrorNote message={error} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="mb-4 p-5">
          <View className="flex-row items-center gap-3">
            <Avatar name={member.name} size={48} />
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-ink">{member.name}</Text>
              <Text className="mt-0.5 text-[12px] text-muted">{member.title ?? 'Staff'}</Text>
              <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                <Badge tone={suspended ? 'red' : member.status === 'ACTIVE' ? 'blue' : 'slate'}>
                  {suspended ? 'Suspended' : member.status === 'ACTIVE' ? 'Active' : 'Revoked'}
                </Badge>
                {clockedIn ? <Badge tone="amber">On shift</Badge> : null}
                {detail.openAlerts ? (
                  <Badge tone="red">
                    {detail.openAlerts} alert{detail.openAlerts === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </View>
            </View>
          </View>
          <Divider />
          <KeyValue label="Joined" value={formatDate(member.joinedAt)} />
          <KeyValue label="Sites" value={String(detail.sites.length)} />
          <KeyValue label="Membership version" value={String(member.membershipVersion)} />
        </Card>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'queries', label: `Queries (${detail.queries.length})` },
          ]}
        />

        {tab === 'overview' ? (
          <>
            <SectionTitle>Assigned sites</SectionTitle>
            {detail.sites.length ? (
              <View className="gap-2">
                {detail.sites.map((site) => (
                  <Pressable key={site.id} onPress={() => router.push(`/sites/${site.id}`)}>
                    <Card className="p-4">
                      <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                          <Text className="text-[13.5px] font-semibold text-ink">{site.name}</Text>
                          <Text className="mt-0.5 text-[11px] text-faint">
                            Assigned {formatDate(site.assignedAt)}
                            {site.clockedInAt ? ` · clocked in ${relativeTime(site.clockedInAt)}` : ''}
                          </Text>
                        </View>
                        {presenceBadge(site.presence)}
                        <IconChevronRight size={15} />
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState
                  icon={<IconUsers size={20} />}
                  title="Not assigned to a site"
                  body="This person is on the general team. Assign them from a site's Staff tab so they can clock in."
                />
              </Card>
            )}

            <SectionTitle>Recent shifts</SectionTitle>
            {detail.recentShifts.length ? (
              <Card className="px-4">
                {detail.recentShifts.map((shift, index) => (
                  <View key={shift.id}>
                    <Pressable onPress={() => router.push(`/history/${shift.id}`)} className="py-3">
                      <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                          <Text className="text-[13px] font-semibold text-ink">{shift.siteName}</Text>
                          <Text className="mt-0.5 text-[11.5px] text-muted">
                            {formatDateTime(shift.startedAt)}
                            {shift.durationMinutes !== null ? ` · ${shift.durationMinutes} min` : ' · on shift'}
                          </Text>
                        </View>
                        <Badge tone={shift.status === 'WORKING' ? 'blue' : 'slate'}>
                          {shift.status === 'WORKING' ? 'Working' : shift.reviewState.toLowerCase().replace('_', ' ')}
                        </Badge>
                        <IconChevronRight size={14} />
                      </View>
                    </Pressable>
                    {index < detail.recentShifts.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="p-4">
                <Text className="text-[12.5px] leading-5 text-muted">No shifts in the last 90 days.</Text>
              </Card>
            )}

            {detail.corrections.length ? (
              <>
                <SectionTitle>Correction requests</SectionTitle>
                <View className="gap-2">
                  {detail.corrections.map((correction) => (
                    <Pressable
                      key={correction.id}
                      onPress={() => router.push(`/team/corrections/${correction.id}`)}
                    >
                      <Card className="p-4">
                        <View className="flex-row items-center gap-3">
                          <View className="flex-1">
                            <Text className="text-[13px] font-semibold text-ink">{correction.siteName}</Text>
                            <Text className="mt-0.5 text-[11.5px] text-muted">
                              Requested {relativeTime(correction.requestedAt)}
                            </Text>
                          </View>
                          {correctionBadge(correction.status)}
                          <IconChevronRight size={14} />
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <SectionTitle>Query the member</SectionTitle>
            <Card className="p-4">
              <Field
                label="Message"
                hint="Recorded on the member file and audit trail. The member is not messaged automatically."
              >
                <Input
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Please explain the missed clock-out on Tuesday…"
                  multiline
                  maxLength={500}
                  style={{ height: 88, textAlignVertical: 'top', paddingTop: 12 }}
                />
              </Field>
              <Button
                label="Record query"
                onPress={() => void sendQuery()}
                loading={busy === 'query'}
                disabled={busy !== null}
                icon={<IconScroll size={16} color="#FFFFFF" />}
              />
            </Card>

            <SectionTitle>Membership</SectionTitle>
            <Card className="p-4">
              <Text className="text-[12.5px] leading-5 text-muted">
                {suspended
                  ? 'Reactivating restores sign-in. Assign the member to a site again before they can clock in.'
                  : 'Suspending ends every active site assignment immediately. The member keeps their account, shifts and corrections.'}
              </Text>
              <View className="mt-3">
                <Field label="Reason" hint="Required. Stored in the audit trail.">
                  <Input
                    value={reason}
                    onChangeText={setReason}
                    placeholder={suspended ? 'Cleared to return to work…' : 'Repeated late clock-outs…'}
                    maxLength={300}
                  />
                </Field>
                <Button
                  label={suspended ? 'Reactivate member' : 'Suspend member'}
                  variant={suspended ? 'secondary' : 'danger'}
                  onPress={confirmStatus}
                  loading={busy === 'status'}
                  disabled={busy !== null || reason.trim().length < 5}
                  icon={
                    suspended ? (
                      <IconCheck size={16} color="#14213D" />
                    ) : (
                      <IconX size={16} color="#B42318" />
                    )
                  }
                />
              </View>
            </Card>
          </>
        ) : (
          <>
            <SectionTitle>Queries</SectionTitle>
            {detail.queries.length ? (
              <Card className="px-4">
                {detail.queries.map((query, index) => (
                  <View key={query.id}>
                    <View className="py-3">
                      <Text className="text-[12.5px] leading-5 text-ink">{query.message}</Text>
                      <Text className="mt-1 text-[11px] text-faint">
                        {query.byName ?? 'Site owner'} · {formatDateTime(query.at)}
                      </Text>
                    </View>
                    {index < detail.queries.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={<IconAlert size={20} />}
                  title="No queries yet"
                  body="Record a query from the Overview tab. Queries are append-only notes in the audit trail."
                />
              </Card>
            )}
            <View className="mt-4 flex-row items-start gap-2">
              <IconInfo size={13} />
              <Text className="flex-1 text-[11px] leading-4 text-faint">
                Queries are internal notes. They do not change attendance, pay or presence state.
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
