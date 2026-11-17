import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ReportSummary } from '@manage/contracts';
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
import { IconChevronRight, IconPlus, IconRefresh, IconScroll } from '@/components/icons';

type Scope = 'mine' | 'team';

export default function ReportsScreen() {
  const router = useRouter();
  const { hasCapability } = useAuth();
  const isStaff = hasCapability('staff.today');
  const canReadTeam = hasCapability('owner.reports');
  const canWrite = isStaff || canReadTeam;
  const [scope, setScope] = useState<Scope>(canReadTeam && !isStaff ? 'team' : 'mine');
  const resource = useApiResource<ReportSummary[]>(() => api.reports(scope), [scope]);

  useFocusEffect(
    useCallback(() => {
      resource.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope]),
  );

  if (!canWrite && !canReadTeam) {
    return (
      <Screen>
        <Header title="Reports" />
        <View className="px-5 pt-4">
          <Card>
            <EmptyState
              icon={<IconScroll size={20} />}
              title="Reports are not available"
              body="Staff write reports. Ask a site owner if you need access."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Reports" subtitle="Shift notes and site updates" />
        <Loading label="Loading reports" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Reports" subtitle="Shift notes and site updates" />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const reports = resource.data ?? [];

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow={scope === 'team' ? 'Oversight' : 'Your notes'}
        title={scope === 'team' ? 'Team reports' : 'Reports'}
        subtitle={
          reports.length
            ? `${reports.length} report${reports.length === 1 ? '' : 's'} · saved securely`
            : 'Write down what happened at a site'
        }
        right={
          <View className="flex-row items-center gap-2">
            {canWrite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Write a report"
                onPress={() => router.push('/reports/new')}
                hitSlop={10}
                className="h-10 w-10 items-center justify-center rounded-full bg-cobalt"
                style={shadowSoft}
              >
                <IconPlus size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh reports"
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
        {canWrite && canReadTeam ? (
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: 'My reports' },
              { value: 'team', label: 'Team reports' },
            ]}
          />
        ) : null}

        {reports.length ? (
          <View className="gap-2.5">
            {reports.map((report) => (
              <Pressable key={report.id} onPress={() => router.push(`/reports/${report.id}`)}>
                <Card className="p-5">
                  <View className="flex-row items-start gap-3">
                    <IconTile tone="blue">
                      <IconScroll size={18} color="#2457D6" />
                    </IconTile>
                    <View className="flex-1">
                      <Text className="text-[15px] font-bold tracking-[-0.2px] text-ink" numberOfLines={2}>
                        {report.title}
                      </Text>
                      <Text className="mt-1 text-[11.5px] text-muted">
                        {scope === 'team' ? `${report.authorName} · ` : ''}
                        {formatDate(report.reportDate)}
                      </Text>
                      <Text className="mt-1.5 text-[12.5px] leading-5 text-muted" numberOfLines={2}>
                        {report.body}
                      </Text>
                      <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                        {report.kind === 'INSPECTION' ? (
                          <Badge tone="amber">Inspection</Badge>
                        ) : null}
                        <Badge tone={report.siteId ? 'blue' : 'slate'}>
                          {report.siteName ?? 'General team'}
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
              icon={<IconScroll size={20} />}
              title={scope === 'team' ? 'No reports yet' : 'No reports yet'}
              body={
                scope === 'team'
                  ? 'Reports your staff submit about a site or the general team appear here.'
                  : 'Use the + button to write a report about your shift or a site. You can edit or delete your own reports at any time.'
              }
            />
          </Card>
        )}

        {scope === 'mine' ? (
          <View className="mt-4">
            <Notice>
              {isStaff
                ? 'Reports are saved to your organization. Site owners can read them; only you can edit or delete your own report.'
                : 'You can write an inspection report for any site where you are the inspector. Open the site and choose “Inspect this site myself” to take it on.'}
            </Notice>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
