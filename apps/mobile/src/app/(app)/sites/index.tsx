import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SiteSummary } from '@manage/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Header,
  IconTile,
  Loading,
  Notice,
  Screen,
  Segmented,
  shadowSoft,
} from '@/components/ui';
import { IconBuilding, IconChevronRight, IconInfo, IconPin, IconPlus, IconRefresh } from '@/components/icons';

type Tab = 'current' | 'previous';
type SiteLists = { current: SiteSummary[]; previous: SiteSummary[] };

export default function SitesScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const [tab, setTab] = useState<Tab>('current');
  const resource = useApiResource<SiteLists>(async () => {
    const [current, previous] = await Promise.all([api.sites('current'), api.sites('previous')]);
    return { current, previous };
  });

  if (!hasCapability('owner.sites')) {
    return (
      <Screen>
        <Header title="Sites" />
        <View className="px-5 pt-4">
          <Card>
            <EmptyState
              icon={<IconBuilding size={20} />}
              title="Sites are for site owners"
              body="Your account can clock in and see its own history. Ask a site owner if you need the site list."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Sites" subtitle="Worksites your organization manages" />
        <Loading label="Loading sites" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Sites" subtitle="Worksites your organization manages" />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const data = resource.data ?? { current: [], previous: [] };
  const sites = tab === 'current' ? data.current : data.previous;
  const onSite = data.current.reduce((total, site) => total + (site.onSiteCount ?? 0), 0);
  const staff = data.current.reduce((total, site) => total + (site.staffCount ?? 0), 0);

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Workspace"
        title="Sites"
        subtitle={
          tab === 'current'
            ? `${data.current.length} site${data.current.length === 1 ? '' : 's'} · ${onSite} of ${staff} staff on site`
            : `${data.previous.length} previous site${data.previous.length === 1 ? '' : 's'}`
        }
        right={
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a site"
              onPress={() => router.push('/sites/new')}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-navy"
              style={shadowSoft}
            >
              <IconPlus size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh sites"
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
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'current', label: `Sites (${data.current.length})` },
            { value: 'previous', label: `Previous (${data.previous.length})` },
          ]}
        />

        {sites.length ? (
          <View className="gap-3">
            {sites.map((site) => {
              const staffCount = site.staffCount ?? 0;
              const onSiteCount = site.onSiteCount ?? 0;
              const ratio = staffCount ? onSiteCount / staffCount : 0;
              const archived = Boolean(site.archivedAt) || site.status === 'INACTIVE';
              return (
                <Pressable key={site.id} onPress={() => router.push(`/sites/${site.id}`)}>
                  <Card className="p-5">
                    <View className="flex-row items-center gap-3">
                      <IconTile tone={archived ? 'canvas' : 'blue'}>
                        <IconBuilding size={18} color={archived ? '#526078' : '#2457D6'} />
                      </IconTile>
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-[16px] font-bold tracking-[-0.2px] text-ink">{site.name}</Text>
                          {archived ? <Badge tone="slate">Archived</Badge> : null}
                        </View>
                        <View className="mt-1 flex-row items-start gap-1.5">
                          <IconPin size={12} />
                          <Text className="flex-1 text-[11.5px] leading-4 text-muted" numberOfLines={1}>
                            {site.address}
                          </Text>
                        </View>
                      </View>
                      <IconChevronRight size={16} />
                    </View>

                    {archived ? (
                      <Text className="mt-3 text-[11px] text-faint">
                        {site.archivedAt
                          ? `Archived ${formatDate(site.archivedAt)} · records stay readable`
                          : 'Inactive · records stay readable'}
                      </Text>
                    ) : (
                      <>
                        <View className="mt-4 flex-row items-end justify-between">
                          <Text className="text-[11px] font-bold uppercase tracking-[0.9px] text-faint">
                            Live presence
                          </Text>
                          <Text className="text-[12.5px] font-semibold text-ink">
                            {onSiteCount} of {staffCount} on site
                          </Text>
                        </View>
                        <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EDF1F8]">
                          <View
                            className="h-full rounded-full bg-cobalt"
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </View>
                      </>
                    )}

                    <View className="mt-4 flex-row flex-wrap items-center gap-1.5">
                      {site.expectedHours ? (
                        <Badge tone="slate">
                          {site.expectedHours.start}–{site.expectedHours.end}
                        </Badge>
                      ) : null}
                      <Badge tone="slate">{site.radiusMeters} m radius</Badge>
                      <Badge tone="slate">{site.timezone}</Badge>
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
              title={tab === 'current' ? 'No sites yet' : 'Nothing archived yet'}
              body={
                tab === 'current'
                  ? 'Create the first worksite with the + button, then invite staff, check the roster and adjust the site policy.'
                  : 'Sites you archive move here. Deleted sites are removed from this list, while their attendance records stay readable for reporting.'
              }
            />
          </Card>
        )}

        <View className="mt-4">
          <Notice>
            {tab === 'current'
              ? 'Site boundaries, time zones and alert policy are versioned. Changing a setting invalidates the previous policy version for new clock-ins but never rewrites existing attendance.'
              : 'Archived sites keep their history. Restore one to make it active again, or delete it to hide it from this list.'}
          </Notice>
        </View>

        <View className="flex-row items-center justify-center gap-1.5">
          <IconInfo size={12} color="#98A4B8" />
          <Text className="text-[11px] text-faint">Pull down to refresh the lists.</Text>
        </View>
      </View>
    </Screen>
  );
}
