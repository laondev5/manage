import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CorrectionSummary, Page, TeamMemberSummary } from '@manage/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDateTime, relativeTime } from '@/lib/format';
import { correctionBadge, presenceBadge } from '@/components/status';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Header,
  IconTile,
  Loading,
  Screen,
  SectionTitle,
  Segmented,
  shadowSoft,
} from '@/components/ui';
import { IconAlert, IconChevronRight, IconPlus, IconRefresh, IconScroll, IconUsers } from '@/components/icons';

type Tab = 'corrections' | 'people';

type TeamData = {
  corrections: Page<CorrectionSummary>;
  members: TeamMemberSummary[];
};

const PRESENCE_ORDER: Record<TeamMemberSummary['sites'][number]['presence'], number> = {
  INSIDE: 0,
  EXIT_PENDING: 1,
  OUTSIDE: 2,
  UNKNOWN: 3,
  NOT_WORKING: 4,
};

function memberPresence(member: TeamMemberSummary): TeamMemberSummary['sites'][number]['presence'] {
  const first = [...member.sites].sort(
    (left, right) => PRESENCE_ORDER[left.presence] - PRESENCE_ORDER[right.presence],
  )[0];
  return first?.presence ?? 'NOT_WORKING';
}

export default function TeamScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const [tab, setTab] = useState<Tab>('corrections');
  const resource = useApiResource<TeamData>(async () => {
    const [corrections, members] = await Promise.all([
      api.corrections({ scope: 'review', limit: 50 }),
      api.teamMembers(),
    ]);
    return { corrections, members };
  });

  if (!hasCapability('owner.team')) {
    return (
      <Screen>
        <Header title="Team" />
        <View className="px-5 pt-4">
          <Card>
            <EmptyState
              icon={<IconUsers size={20} />}
              title="Team is for site owners"
              body="Your account can clock in and see its own history. Ask a site owner if you need the roster."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Team" subtitle="Corrections and assigned staff" />
        <Loading label="Loading the team" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Team" subtitle="Corrections and assigned staff" />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const data = resource.data;
  if (!data) return null;
  const corrections = data.corrections.items;
  const members = data.members;
  const pending = corrections.filter((entry) => entry.status === 'PENDING');
  const onSite = members.filter((member) => memberPresence(member) === 'INSIDE').length;
  const siteCount = new Set(members.flatMap((member) => member.sites.map((site) => site.id))).size;

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="People"
        title="Team"
        subtitle={`${members.length} ${members.length === 1 ? 'person' : 'people'} · ${onSite} on site · ${
          pending.length
        } correction${pending.length === 1 ? '' : 's'} waiting`}
        right={
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Team reports"
              onPress={() => router.push('/reports')}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={shadowSoft}
            >
              <IconScroll size={17} color="#14213D" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a team member"
              onPress={() => router.push('/team/invite')}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-cobalt"
              style={shadowSoft}
            >
              <IconPlus size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh team"
              onPress={resource.refresh}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={shadowSoft}
            >
              <IconRefresh size={17} color="#14213D" />
            </Pressable>
          </View>
        }
      />

      <View className="px-5 pt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'corrections', label: `Corrections (${pending.length})` },
            { value: 'people', label: `People (${members.length})` },
          ]}
        />

        {resource.error ? (
          <View className="mt-3">
            <ErrorNote message={resource.error} onRetry={resource.reload} />
          </View>
        ) : null}

        {tab === 'corrections' ? (
          <>
            <SectionTitle
              right={
                <Text className="text-[11.5px] text-faint">
                  {corrections.length} request{corrections.length === 1 ? '' : 's'}
                </Text>
              }
            >
              Review queue
            </SectionTitle>

            {corrections.length ? (
              <View className="gap-2.5">
                {corrections.map((correction) => (
                  <Pressable
                    key={correction.id}
                    onPress={() => router.push(`/team/corrections/${correction.id}`)}
                  >
                    <Card className="p-5">
                      <View className="flex-row items-start gap-3">
                        <IconTile tone="blue">
                          <IconAlert size={18} color="#2457D6" />
                        </IconTile>
                        <View className="flex-1">
                          <Text className="text-[14.5px] font-semibold text-ink">{correction.workerName}</Text>
                          <Text className="mt-0.5 text-[11.5px] text-muted">
                            {correction.siteName} · requested {relativeTime(correction.requestedAt)}
                          </Text>
                          <Text className="mt-1.5 text-[12px] leading-4 text-muted" numberOfLines={2}>
                            {correction.reason}
                          </Text>
                          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                            {correctionBadge(correction.status)}
                            <Badge tone="slate">
                              {formatDateTime(correction.proposedStartAt)}
                              {correction.proposedEndAt
                                ? ` → ${formatDateTime(correction.proposedEndAt)}`
                                : ' → open'}
                            </Badge>
                          </View>
                        </View>
                        <IconChevronRight size={16} />
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState
                  icon={<IconAlert size={20} />}
                  title="No corrections waiting"
                  body="When staff ask to amend a shift, the request appears here with the original and proposed times."
                />
              </Card>
            )}
          </>
        ) : (
          <>
            <SectionTitle
              right={
                <Text className="text-[11.5px] text-faint">
                  {onSite} on site · {siteCount} site{siteCount === 1 ? '' : 's'}
                </Text>
              }
            >
              People
            </SectionTitle>

            {members.length ? (
              <View className="gap-2">
                {members.map((member) => {
                  const presence = memberPresence(member);
                  const siteNames = member.sites.map((site) => site.name);
                  return (
                    <Pressable
                      key={member.memberId}
                      onPress={() => router.push(`/team/${member.memberId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${member.name}`}
                    >
                      <Card className="flex-row items-center gap-3 p-4">
                        <Avatar name={member.name} size={40} />
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-[13.5px] font-semibold text-ink" numberOfLines={1}>
                              {member.name}
                            </Text>
                            {member.status === 'SUSPENDED' ? <Badge tone="red">Suspended</Badge> : null}
                          </View>
                          <Text className="mt-0.5 text-[11.5px] text-muted" numberOfLines={1}>
                            {member.title ? `${member.title} · ` : ''}
                            {member.email}
                          </Text>
                          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                            {member.status === 'SUSPENDED' ? (
                              <Badge tone="slate">Access paused</Badge>
                            ) : siteNames.length ? (
                              presenceBadge(presence)
                            ) : (
                              <Badge tone="slate">No site yet</Badge>
                            )}
                            <Badge tone="slate">
                              {siteNames.length
                                ? siteNames.join(', ')
                                : 'General team'}
                            </Badge>
                          </View>
                        </View>
                        <IconChevronRight size={16} />
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Card>
                <EmptyState
                  icon={<IconUsers size={20} />}
                  title="Nobody on the team yet"
                  body="Add someone to your general team or to a site with the plus button above. Memberships are invitation-only."
                />
              </Card>
            )}
          </>
        )}

        <Text className="mt-5 text-center text-[11px] leading-4 text-faint">
          Roster presence reflects the last accepted location readings. Pull down to refresh.
        </Text>
      </View>
    </Screen>
  );
}
