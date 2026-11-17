import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ShiftSummary } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { daysAgoInput, formatClock, formatDate, humanDuration, toIsoRangeEnd, toIsoRangeStart, todayInput } from '@/lib/format';
import { reviewBadge } from '@/components/status';
import { Badge, Button, Card, EmptyState, ErrorNote, Header, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { IconChevronRight, IconClock, IconScroll } from '@/components/icons';

type Range = '7' | '30' | '90';

export default function HistoryScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>('30');
  const [items, setItems] = useState<ShiftSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, mode: 'replace' | 'more' | 'refresh') => {
      if (mode === 'replace') setLoading(true);
      if (mode === 'more') setLoadingMore(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        const page = await api.history({
          from: toIsoRangeStart(daysAgoInput(Number(range))),
          to: toIsoRangeEnd(todayInput()),
          ...(nextCursor ? { cursor: nextCursor } : {}),
          limit: 25,
        });
        setItems((current) => (mode === 'more' ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (cause) {
        setError(messageOf(cause, 'Your history could not be loaded.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [range],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void fetchPage(null, 'replace');
  }, [fetchPage]);

  const minutes = items.reduce((total, shift) => total + (shift.durationMinutes ?? 0), 0);
  const openShifts = items.filter((shift) => shift.status === 'WORKING').length;
  const needsReview = items.filter((shift) => shift.reviewState === 'NEEDS_REVIEW' || shift.pendingCorrection).length;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void fetchPage(null, 'refresh')}>
      <Header
        title="Shift history"
        subtitle="Every recorded shift, with the evidence behind it."
        right={
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white" style={{ shadowColor: '#101D35', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }}>
            <IconScroll size={17} color="#14213D" />
          </View>
        }
      />

      <View className="px-5 pt-4">
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: 'This week' },
            { value: '30', label: 'This month' },
            { value: '90', label: 'Last 90 days' },
          ]}
        />

        <Card className="mt-4 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-[1px] text-faint">Payable total</Text>
              <Text className="mt-1 text-[27px] font-bold leading-8 tracking-[-0.5px] text-ink">
                {humanDuration(minutes)}
              </Text>
            </View>
            <View className="h-12 w-px bg-line" />
            <View className="flex-1 items-center">
              <Text className="text-[10px] font-bold uppercase tracking-[1px] text-faint">Completed</Text>
              <Text className="mt-1 text-[27px] font-bold leading-8 tracking-[-0.5px] text-ink">
                {items.length}
              </Text>
            </View>
            <View className="h-12 w-px bg-line" />
            <View className="flex-1 items-end">
              <Text className="text-[10px] font-bold uppercase tracking-[1px] text-faint">Review</Text>
              <Text className={needsReview ? 'mt-1 text-[27px] font-bold leading-8 tracking-[-0.5px] text-amber' : 'mt-1 text-[27px] font-bold leading-8 tracking-[-0.5px] text-ink'}>
                {needsReview}
              </Text>
            </View>
          </View>
          {openShifts ? (
            <Text className="mt-2 text-[11px] text-cobalt">{openShifts} shift still in progress</Text>
          ) : null}
        </Card>

        <SectionTitle>Logged days</SectionTitle>

        {loading ? (
          <Loading label="Reading your shifts" />
        ) : error ? (
          <ErrorNote message={error} onRetry={() => void fetchPage(null, 'replace')} />
        ) : items.length ? (
          <View className="gap-3">
            {items.map((shift) => {
              const date = formatDate(shift.startedAt, shift.timezone);
              const [weekday = '', rest = ''] = date.split(', ');
              return (
                <Pressable key={shift.id} onPress={() => router.push(`/history/${shift.id}`)}>
                  <Card className="p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[10.5px] font-bold uppercase tracking-[1px] text-faint">
                          {weekday}
                        </Text>
                        <Text className="mt-0.5 text-[15.5px] font-bold tracking-[-0.2px] text-ink">{rest}</Text>
                        <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
                          {shift.siteName}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[17px] font-bold tracking-[-0.3px] text-ink">
                          {shift.status === 'WORKING' ? 'Open' : humanDuration(shift.durationMinutes)}
                        </Text>
                        <Text className="mt-0.5 text-[11px] text-muted">
                          {formatClock(shift.startedAt, shift.timezone)}
                          {shift.endedAt ? ` – ${formatClock(shift.endedAt, shift.timezone)}` : ''}
                        </Text>
                      </View>
                      <IconChevronRight size={15} />
                    </View>
                    <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
                      {shift.status === 'WORKING' ? <Badge tone="navy">Open shift</Badge> : reviewBadge(shift.reviewState)}
                      {shift.pendingCorrection ? <Badge tone="amber">Correction pending</Badge> : null}
                      {shift.presence === 'OUTSIDE' ? <Badge tone="amber">Boundary exception</Badge> : null}
                    </View>
                    {shift.reviewReason ? (
                      <Text className="mt-2 text-[11.5px] leading-4 text-amber">{shift.reviewReason}</Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}

            {cursor ? (
              <View className="pt-1">
                <Button
                  label="Load older shifts"
                  variant="secondary"
                  loading={loadingMore}
                  onPress={() => void fetchPage(cursor, 'more')}
                />
              </View>
            ) : (
              <View className="flex-row items-center justify-center gap-1.5 pt-3">
                <IconClock size={12} color="#98A4B8" />
                <Text className="text-[11px] text-faint">That is the whole range.</Text>
              </View>
            )}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={<IconScroll size={20} />}
              title="No shifts in this range"
              body="Once you clock in, your shifts appear here with times, presence evidence and any correction requests."
            />
          </Card>
        )}
      </View>
    </Screen>
  );
}
