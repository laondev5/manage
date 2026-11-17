import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AlertSummary, Page } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { relativeTime } from '@/lib/format';
import { alertStateBadge } from '@/components/status';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Header,
  IconTile,
  Loading,
  Screen,
  Segmented,
  shadowSoft,
} from '@/components/ui';
import { IconBell, IconChevronRight, IconRefresh } from '@/components/icons';

type Filter = 'ALL' | 'UNREAD' | 'READ' | 'REVIEWED';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'READ', label: 'Read' },
  { value: 'REVIEWED', label: 'Reviewed' },
];

export default function AlertsScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const [filter, setFilter] = useState<Filter>('ALL');
  const resource = useApiResource<Page<AlertSummary>>(
    () => api.alerts(filter === 'ALL' ? { limit: 50 } : { state: filter, limit: 50 }),
    [filter],
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  if (!hasCapability('owner.alerts')) {
    return (
      <Screen>
        <Header title="Alerts" />
        <View className="px-5 pt-4">
          <Card>
            <EmptyState
              icon={<IconBell size={20} />}
              title="Alerts are for site owners"
              body="Your account can clock in and see its own history. Ask a site owner if you need the departure inbox."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Alerts" subtitle="Departures that need a decision" />
        <Loading label="Reading the alert inbox" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Alerts" subtitle="Departures that need a decision" />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const page = resource.data;
  const alerts = page?.items ?? [];
  const open = alerts.filter((alert) => alert.state !== 'REVIEWED').length;
  const unread = alerts.filter((alert) => alert.state === 'UNREAD').length;

  const loadMore = async () => {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.alerts(
        filter === 'ALL'
          ? { cursor: page.nextCursor, limit: 50 }
          : { state: filter, cursor: page.nextCursor, limit: 50 },
      );
      resource.setData({ items: [...alerts, ...next.items], nextCursor: next.nextCursor });
    } catch (cause) {
      setMoreError(messageOf(cause, 'Older alerts could not be loaded.'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Inbox"
        title="Alerts"
        subtitle={`${open} open · ${unread} unread · ${alerts.length} loaded`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh alerts"
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
        <Segmented value={filter} onChange={setFilter} options={FILTERS} />

        {resource.error ? (
          <View className="mt-3">
            <ErrorNote message={resource.error} onRetry={resource.reload} />
          </View>
        ) : null}

        <View className="mt-4 gap-2.5">
          {alerts.length ? (
            alerts.map((alert) => (
              <Pressable key={alert.id} onPress={() => router.push(`/alerts/${alert.id}`)}>
                <Card className="p-5">
                  <View className="flex-row items-start gap-3">
                    <IconTile tone={alert.state === 'UNREAD' ? 'amber' : alert.state === 'READ' ? 'blue' : 'canvas'}>
                      <IconBell
                        size={18}
                        color={alert.state === 'UNREAD' ? '#B54708' : alert.state === 'READ' ? '#2457D6' : '#7C89A0'}
                      />
                    </IconTile>
                    <View className="flex-1">
                      <Text className="text-[14.5px] font-semibold leading-5 text-ink">
                        {alert.workerName} <Text className="font-normal text-muted">left</Text> {alert.siteName}
                      </Text>
                      <Text className="mt-1 text-[11.5px] text-muted">
                        Detected {relativeTime(alert.detectedAt)}
                        {alert.lastUpdateAt ? ` · updated ${relativeTime(alert.lastUpdateAt)}` : ''}
                      </Text>
                      <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                        {alertStateBadge(alert.state)}
                        {alert.stillWorking ? (
                          <Badge tone="amber">Still clocked in</Badge>
                        ) : (
                          <Badge tone="slate">Clocked out</Badge>
                        )}
                      </View>
                    </View>
                    <IconChevronRight size={16} />
                  </View>
                </Card>
              </Pressable>
            ))
          ) : (
            <Card>
              <EmptyState
                icon={<IconBell size={20} />}
                title={filter === 'ALL' ? 'No departure alerts' : 'Nothing in this filter'}
                body={
                  filter === 'ALL'
                    ? 'When a clocked-in staff member stays outside the site past the grace period, the alert appears here with its evidence.'
                    : 'Switch filters to see the rest of the inbox.'
                }
              />
            </Card>
          )}
        </View>

        {page?.nextCursor ? (
          <View className="mt-4">
            {moreError ? <ErrorNote message={moreError} /> : null}
            <Button
              label={loadingMore ? 'Loading…' : 'Load older alerts'}
              variant="secondary"
              onPress={() => void loadMore()}
              disabled={loadingMore}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
