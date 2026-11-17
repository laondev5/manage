import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { OnboardingState, OwnerOverview as OwnerOverviewData } from '@manage/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { relativeTime } from '@/lib/format';
import { alertStateBadge } from './status';
import {
  IconAlert,
  IconBell,
  IconBuilding,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconRefresh,
  IconUsers,
} from './icons';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Header,
  HeroCard,
  IconTile,
  Loading,
  ProgressRing,
  Screen,
  SectionTitle,
  Stat,
  shadowSoft,
} from './ui';

type OverviewData = { overview: OwnerOverviewData; onboarding: OnboardingState };

export function OwnerOverview() {
  const router = useRouter();
  const { me } = useAuth();
  const resource = useApiResource<OverviewData>(async () => {
    const [overview, onboarding] = await Promise.all([api.ownerOverview(), api.onboarding()]);
    return { overview, onboarding };
  });

  const membership = me?.activeOrganizationId
    ? me.memberships.find((entry) => entry.organizationId === me.activeOrganizationId)
    : me?.memberships[0];
  const orgName = membership?.organizationName ?? 'Your workspace';

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Home" subtitle={orgName} />
        <Loading label="Reading the day" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Home" subtitle={orgName} />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const overview = resource.data?.overview;
  if (!overview) return null;
  const onboarding = resource.data?.onboarding.owner;
  const onboardingSteps = onboarding
    ? [onboarding.siteDetailsDone, onboarding.boundaryDone, onboarding.inviteDone, onboarding.alertsReviewed]
    : [];
  const onboardingDone = onboardingSteps.filter(Boolean).length;
  const presence = overview.staffAssigned ? overview.staffOnSite / overview.staffAssigned : 0;
  const notClockedIn = Math.max(0, overview.staffAssigned - overview.staffOnSite);
  const firstName = me?.user.name.split(' ')[0] ?? 'there';

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Workspace"
        title="Home"
        subtitle={`${orgName} · updated ${relativeTime(overview.generatedAt)}`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh home"
            onPress={resource.refresh}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
            style={shadowSoft}
          >
            <IconRefresh size={17} color="#14213D" />
          </Pressable>
        }
      />
      <Text className="px-5 pt-3 text-[13.5px] text-muted">
        Today, <Text className="font-semibold text-cobalt">{firstName}</Text>
      </Text>

      <View className="px-5 pt-4">
        <HeroCard className="p-5">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-[#8FA3C8]">
                On site now
              </Text>
              <Text className="mt-1.5 text-[42px] font-bold leading-[46px] tracking-[-1.2px] text-white">
                {overview.staffOnSite}
              </Text>
              <Text className="mt-1 text-[12.5px] text-[#AEBBD4]">
                of {overview.staffAssigned} assigned staff
              </Text>
            </View>
            <ProgressRing progress={presence} size={84} stroke={7}>
              <Text className="text-[15px] font-bold text-white">{Math.round(presence * 100)}%</Text>
            </ProgressRing>
          </View>

          <View className="mt-5 h-px w-full bg-white/10" />

          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <IconClock size={15} color="#AEBBD4" />
              <Text className="text-[12.5px] text-[#D9E1F0]">
                <Text className="font-bold text-white">{overview.hoursToday.toFixed(1)}h</Text> recorded today
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <IconBell size={15} color="#AEBBD4" />
              <Text className="text-[12.5px] text-[#D9E1F0]">
                <Text className="font-bold text-white">{overview.openAlerts}</Text> open alerts
              </Text>
            </View>
          </View>
        </HeroCard>

        <View className="mt-3 flex-row gap-2.5">
          <Stat
            label="Open alerts"
            value={overview.openAlerts}
            hint="unread or unconfirmed"
            tone={overview.openAlerts ? 'amber' : 'default'}
          />
          <Stat
            label="Corrections"
            value={overview.pendingCorrections}
            hint="awaiting a decision"
            tone={overview.pendingCorrections ? 'blue' : 'default'}
          />
        </View>

        {overview.openAlerts > 0 ? (
          <Pressable onPress={() => router.push('/alerts')} className="mt-3">
            <Card className="flex-row items-center gap-3 bg-amber-soft p-4">
              <IconTile tone="amber">
                <IconAlert size={18} color="#B54708" />
              </IconTile>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-ink">
                  {overview.openAlerts} departure alert{overview.openAlerts === 1 ? '' : 's'} need attention
                </Text>
                <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                  A clocked-in staff member stayed outside a site past the grace period.
                </Text>
              </View>
              <IconChevronRight size={16} color="#B54708" />
            </Card>
          </Pressable>
        ) : null}

        {onboarding && !onboarding.completedAt ? (
          <Pressable onPress={() => router.push('/onboarding')} className="mt-3">
            <Card className="flex-row items-center gap-3 border border-cobalt-border bg-[#F8FAFF] p-4">
              <IconTile tone="blue">
                <IconInfo size={18} color="#2457D6" />
              </IconTile>
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-ink">Finish workspace setup</Text>
                <Text className="mt-0.5 text-[11.5px] text-muted">
                  {onboardingDone} of 4 steps done ·{' '}
                  {onboardingDone === 4 ? 'mark it complete' : `${4 - onboardingDone} left`}
                </Text>
              </View>
              <IconChevronRight size={16} color="#2457D6" />
            </Card>
          </Pressable>
        ) : null}

        <SectionTitle
          right={
            <Pressable onPress={() => router.push('/sites')} hitSlop={8}>
              <Text className="text-[12px] font-semibold text-cobalt">All sites</Text>
            </Pressable>
          }
        >
          Sites
        </SectionTitle>

        {overview.sites.length ? (
          <View className="gap-2.5">
            {overview.sites.map((site) => {
              const ratio = site.assignedCount ? site.onSiteCount / site.assignedCount : 0;
              return (
                <Pressable key={site.id} onPress={() => router.push(`/sites/${site.id}`)}>
                  <Card className="p-5">
                    <View className="flex-row items-center gap-3">
                      <IconTile tone="blue">
                        <IconBuilding size={18} color="#2457D6" />
                      </IconTile>
                      <View className="flex-1">
                        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                          {site.name}
                        </Text>
                        <Text className="mt-0.5 text-[11.5px] text-muted">
                          {site.onSiteCount} of {site.assignedCount} on site now
                        </Text>
                      </View>
                      <IconChevronRight size={16} />
                    </View>

                    <View className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EDF1F8]">
                      <View
                        className="h-full rounded-full bg-cobalt"
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </View>

                    <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
                      {site.openAlerts ? (
                        <Badge tone="amber">
                          {site.openAlerts} alert{site.openAlerts === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <Badge tone="blue">No open alerts</Badge>
                      )}
                      {site.presenceUncertain ? (
                        <Badge tone="slate">{site.presenceUncertain} uncertain</Badge>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={<IconBuilding size={20} />}
              title="No sites yet"
              body="Create your first worksite in the web console, then invite staff from the Site screen here."
            />
          </Card>
        )}

        <SectionTitle
          right={
            <Pressable onPress={() => router.push('/alerts')} hitSlop={8}>
              <Text className="text-[12px] font-semibold text-cobalt">All alerts</Text>
            </Pressable>
          }
        >
          Recent departures
        </SectionTitle>

        {overview.recentAlerts.length ? (
          <View className="gap-2">
            {overview.recentAlerts.slice(0, 5).map((alert) => (
              <Pressable key={alert.id} onPress={() => router.push(`/alerts/${alert.id}`)}>
                <Card className="flex-row items-center gap-3 p-4">
                  <IconTile tone="canvas">
                    <IconBell size={17} />
                  </IconTile>
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink" numberOfLines={1}>
                      {alert.workerName} <Text className="font-normal text-muted">left</Text> {alert.siteName}
                    </Text>
                    <Text className="mt-0.5 text-[11.5px] text-muted">
                      Detected {relativeTime(alert.detectedAt)}
                    </Text>
                  </View>
                  {alertStateBadge(alert.state)}
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={<IconBell size={20} />}
              title="No departure alerts"
              body="When a clocked-in staff member stays outside the site past the grace period, the alert appears here with its evidence."
            />
          </Card>
        )}

        <SectionTitle>Team health</SectionTitle>
        <Card className="p-5">
          <View className="flex-row items-center gap-3">
            <IconTile tone="navy">
              <IconUsers size={18} color="#FFFFFF" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">
                {overview.staffOnSite} on site · {notClockedIn} not clocked in
              </Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                Membership is invitation-only. Manage people and corrections from the Team tab.
              </Text>
            </View>
            <Pressable onPress={() => router.push('/team')} hitSlop={8}>
              <IconChevronRight size={16} />
            </Pressable>
          </View>
        </Card>

        <Text className="mt-6 text-center text-[11px] text-faint">
          Live view generated {relativeTime(overview.generatedAt)} · pull down to refresh
        </Text>
      </View>
    </Screen>
  );
}
