import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type {
  AttendanceEventInput,
  CurrentShiftResponse,
  LocationReading,
  OnboardingState,
  SiteSummary,
} from '@manage/contracts';
import { ApiClientError } from '@manage/api-client';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ensureDeviceId } from '@/lib/device';
import { newId } from '@/lib/ids';
import { useApiResource } from '@/lib/hooks';
import {
  enqueueEvent,
  flushQueue,
  readActiveShift,
  readQueue,
  writeActiveShift,
  type LocalShift,
  type QueuedEvent,
} from '@/lib/queue';
import {
  currentReading,
  flushLocationData,
  isTracking,
  permissionStatus,
  requestLocationPermissions,
  startTracking,
  stopTracking,
  type PermissionOutcome,
} from '@/lib/location';
import { distanceLabel } from '@/lib/geo';
import { formatClock, formatDate, humanDuration, relativeTime } from '@/lib/format';
import { presenceBadge, reviewBadge } from './status';
import { BrandLockup } from './brand';
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconPin,
  IconRefresh,
  IconShield,
  IconX,
  IconLogout,
} from './icons';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Header,
  HeroCard,
  IconTile,
  Input,
  Loading,
  Notice,
  ProgressRing,
  Screen,
  SectionTitle,
  shadowFloat,
  shadowSoft,
} from './ui';

type TodayData = {
  shift: CurrentShiftResponse;
  sites: SiteSummary[];
  onboarding: OnboardingState;
};

type Receipt = {
  workedMinutes: number | null;
  startedAt: string;
  endedAt: string;
  reviewReason: string | null;
};

function isOfflineError(cause: unknown): boolean {
  if (!(cause instanceof ApiClientError)) return true;
  return cause.status >= 500 || cause.status === 0;
}

function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function windowMinutes(start: string, end: string): number {
  const span = timeToMinutes(end) - timeToMinutes(start);
  return span > 0 ? span : span + 24 * 60;
}

export function StaffToday() {
  const router = useRouter();
  const { siteId: siteIdParam } = useLocalSearchParams<{ siteId?: string }>();
  const { me } = useAuth();
  const resource = useApiResource<TodayData>(async () => {
    const [shift, sites, onboarding] = await Promise.all([
      api.currentShift(),
      api.sites(),
      api.onboarding(),
    ]);
    return { shift, sites, onboarding };
  });
  const [localShift, setLocalShift] = useState<LocalShift | null>(null);
  const [queueEvents, setQueueEvents] = useState<QueuedEvent[]>([]);
  const [tracking, setTracking] = useState(false);
  const [permission, setPermission] = useState<PermissionOutcome | 'undetermined'>('undetermined');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [reading, setReading] = useState<LocationReading | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'in' | 'out' | 'sync' | 'permission' | 'check' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmingOut, setConfirmingOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const active = resource.data?.shift.activeShift ?? null;
  const sites = resource.data?.sites ?? [];
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? sites[0] ?? null;

  const meta = me?.activeOrganizationId
    ? me.memberships.find((entry) => entry.organizationId === me.activeOrganizationId)
    : me?.memberships[0];

  const loadLocal = useCallback(async () => {
    const [local, queue, running, status] = await Promise.all([
      readActiveShift(),
      readQueue(),
      isTracking(),
      permissionStatus(),
    ]);
    setLocalShift(local);
    setQueueEvents(queue);
    setTracking(running);
    setPermission(status);
    if (!local || queue.length) return;
    // A queued clock event may have synced in the background. Reconcile with the server
    // once the local shift is old enough that no in-flight clock-in could own it.
    if (Date.now() - new Date(local.startedAt).getTime() < 30_000) return;
    try {
      const server = await api.currentShift();
      if (server.activeShift) return;
      await writeActiveShift(null);
      await stopTracking();
      setLocalShift(null);
      setTracking(false);
      if (local.shiftId && server.lastEndedShift?.siteId === local.siteId) {
        setReceipt({
          workedMinutes: server.lastEndedShift.durationMinutes,
          startedAt: server.lastEndedShift.startedAt,
          endedAt: server.lastEndedShift.endedAt ?? new Date().toISOString(),
          reviewReason: null,
        });
      } else if (!local.shiftId) {
        setActionError('Your saved clock-in was not accepted. Ask your owner to review the shift.');
      }
    } catch {
      // Offline: keep the local shift and queue untouched.
    }
  }, []);

  const reload = resource.reload;

  useFocusEffect(
    useCallback(() => {
      void loadLocal();
      reload();
    }, [loadLocal, reload]),
  );

  useEffect(() => {
    if (typeof siteIdParam === 'string' && siteIdParam) {
      setSelectedSiteId(siteIdParam);
      setReading(null);
    }
  }, [siteIdParam]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // A queued clock-in syncs in the background; adopt the server shift so presence checks can start.
  useEffect(() => {
    if (!active || !localShift || localShift.shiftId) return;
    if (localShift.siteId !== active.siteId) return;
    let cancelled = false;
    void (async () => {
      const merged: LocalShift = { ...localShift, shiftId: active.id, startedAt: active.startedAt };
      await writeActiveShift(merged);
      if (cancelled) return;
      setLocalShift(merged);
      await startTracking();
      if (!cancelled) setTracking(await isTracking());
    })();
    return () => {
      cancelled = true;
    };
  }, [active, localShift]);

  const pendingClockIn = queueEvents.some((entry) => entry.event.type === 'CLOCK_IN');
  const pendingClockOut = useMemo(() => {
    if (!localShift) return false;
    return queueEvents.some(
      (entry) =>
        entry.event.type === 'CLOCK_OUT' && entry.event.clientShiftId === localShift.clientShiftId,
    );
  }, [localShift, queueEvents]);

  const checkLocation = async () => {
    setBusy('check');
    setActionError(null);
    try {
      if (permission !== 'granted' && permission !== 'foreground-only') {
        const outcome = await requestLocationPermissions();
        setPermission(outcome);
        if (outcome === 'denied') {
          setActionError('Location permission is off. Enable it in system settings to record attendance.');
          return;
        }
      }
      const result = await currentReading();
      if (!result) {
        setActionError('A location reading is not available right now. Move somewhere with a clearer view of the sky and try again.');
        return;
      }
      setReading(result);
    } finally {
      setBusy(null);
    }
  };

  const clockIn = async () => {
    if (!selectedSite) return;
    setBusy('in');
    setActionError(null);
    setSyncMessage(null);
    try {
      const outcome = await requestLocationPermissions();
      setPermission(outcome);
      if (outcome === 'denied') {
        setActionError(
          'Location permission is off. Manage needs your location at clock-in and while you are clocked in, so enable it in system settings and try again.',
        );
        return;
      }
      const location = await currentReading();
      const deviceId = await ensureDeviceId();
      const capturedAt = new Date().toISOString();
      const clientShiftId = newId();
      const event: AttendanceEventInput = {
        clientEventId: newId(),
        clientShiftId,
        deviceId,
        siteId: selectedSite.id,
        type: 'CLOCK_IN',
        capturedAt,
        location,
        sitePolicyVersion: selectedSite.policyVersion,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      try {
        const result = await api.clock(event, event.clientEventId);
        if (result.outcome === 'REJECTED' || !result.shift) {
          setActionError(result.reviewReason ?? result.message);
          return;
        }
        const local: LocalShift = {
          clientShiftId,
          shiftId: result.shift.id,
          siteId: result.shift.siteId,
          siteName: result.shift.siteName,
          policyVersion: selectedSite.policyVersion,
          radiusMeters: selectedSite.radiusMeters,
          timezone: result.shift.timezone,
          startedAt: result.shift.startedAt,
        };
        await writeActiveShift(local);
        setLocalShift(local);
        setNote('');
        setReading(null);
        setReceipt(null);
        const started = await startTracking();
        setTracking(started.tracking);
        if (!started.background) {
          setSyncMessage(
            'Clocked in. Background location is limited, so keep Manage open while you work or presence may show as uncertain.',
          );
        } else if (result.outcome === 'NEEDS_REVIEW') {
          setSyncMessage(
            result.reviewReason
              ? `Clocked in for review: ${result.reviewReason}`
              : 'Clocked in. Your owner will review the location reading.',
          );
        }
        resource.reload();
      } catch (cause) {
        if (!isOfflineError(cause)) {
          setActionError(messageOf(cause, 'Clock-in did not complete.'));
          return;
        }
        await enqueueEvent(event, event.clientEventId);
        const local: LocalShift = {
          clientShiftId,
          shiftId: '',
          siteId: selectedSite.id,
          siteName: selectedSite.name,
          policyVersion: selectedSite.policyVersion,
          radiusMeters: selectedSite.radiusMeters,
          timezone: selectedSite.timezone,
          startedAt: capturedAt,
        };
        await writeActiveShift(local);
        setLocalShift(local);
        setQueueEvents(await readQueue());
        setNote('');
        setReading(null);
        setSyncMessage('You are offline. The clock-in is encrypted on this device and will be sent automatically.');
      }
    } finally {
      setBusy(null);
    }
  };

  const clockOut = async () => {
    if (!localShift) return;
    setBusy('out');
    setActionError(null);
    try {
      if (!localShift.shiftId) {
        setActionError('The clock-in is still waiting to sync. Go online and sync before clocking out.');
        return;
      }
      const location = await currentReading();
      const deviceId = await ensureDeviceId();
      const capturedAt = new Date().toISOString();
      const event: AttendanceEventInput = {
        clientEventId: newId(),
        clientShiftId: localShift.clientShiftId,
        deviceId,
        siteId: localShift.siteId,
        type: 'CLOCK_OUT',
        capturedAt,
        location,
        sitePolicyVersion: localShift.policyVersion,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      try {
        const result = await api.clock(event, event.clientEventId);
        if (result.outcome === 'REJECTED') {
          setActionError(result.reviewReason ?? result.message);
          return;
        }
        await stopTracking();
        await flushLocationData();
        await writeActiveShift(null);
        setLocalShift(null);
        setTracking(false);
        setQueueEvents([]);
        setNote('');
        const ended = result.shift;
        if (ended) {
          setReceipt({
            workedMinutes: ended.durationMinutes,
            startedAt: ended.startedAt,
            endedAt: ended.endedAt ?? capturedAt,
            reviewReason: result.reviewReason,
          });
        }
        resource.reload();
      } catch (cause) {
        if (!isOfflineError(cause)) {
          setActionError(messageOf(cause, 'Clock-out did not complete.'));
          return;
        }
        await enqueueEvent(event, event.clientEventId);
        setQueueEvents(await readQueue());
        await stopTracking();
        setTracking(false);
        setSyncMessage('You are offline. The clock-out is saved on this device and will close the shift when you reconnect.');
      }
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    setSyncMessage(null);
    try {
      const result = await flushQueue();
      await flushLocationData();
      await loadLocal();
      resource.reload();
      setSyncMessage(
        result.remaining
          ? `${result.accepted} sent. ${result.remaining} still waiting — we will retry automatically.`
          : result.accepted
            ? `${result.accepted} saved event${result.accepted === 1 ? '' : 's'} sent.`
            : 'Everything is already in sync.',
      );
    } catch (cause) {
      setActionError(messageOf(cause, 'The queue could not be sent yet.'));
    } finally {
      setBusy(null);
    }
  };

  const enableLocation = async () => {
    setBusy('permission');
    setActionError(null);
    try {
      const outcome = await requestLocationPermissions();
      setPermission(outcome);
      if (outcome === 'denied') {
        setActionError('Location permission is off. Enable it in system settings to record attendance.');
      }
    } finally {
      setBusy(null);
    }
  };

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Today" subtitle="Manage attendance" />
        <Loading label="Checking your shift" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Today" subtitle="Manage attendance" />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const working = Boolean(localShift && active);
  const measured = reading && selectedSite ? distanceLabel(reading, selectedSite) : null;
  const onboarding = resource.data?.onboarding.staff;
  const onboardingDone = onboarding
    ? [onboarding.detailsConfirmed, onboarding.siteReviewed, onboarding.readinessCompleted].filter(Boolean)
        .length
    : 0;
  const firstName = me?.user.name.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const schedule = selectedSite?.expectedHours ?? null;
  const scheduledMinutes = schedule ? windowMinutes(schedule.start, schedule.end) : 8 * 60;
  const elapsedMinutes = active
    ? Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 60_000))
    : 0;
  const shiftProgress = Math.min(1, elapsedMinutes / scheduledMinutes);

  return (
    <Screen refreshing={resource.refreshing} onRefresh={() => { resource.refresh(); void loadLocal(); }}>
      <View className="px-5 pt-1">
        <View className="flex-row items-center justify-between">
          <BrandLockup height={20} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            onPress={() => { resource.refresh(); void loadLocal(); }}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
            style={shadowSoft}
          >
            <IconRefresh size={17} color="#14213D" />
          </Pressable>
        </View>
        <Text className="mt-7 text-[13.5px] text-muted">
          {greeting}, <Text className="font-semibold text-cobalt">{firstName}</Text>
        </Text>
        <Text className="mt-1 text-[32px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
          {working ? 'You are ' : 'Ready to '}
          <Text className="text-cobalt">{working ? 'on the clock.' : 'start?'}</Text>
        </Text>
        <Text className="mt-2 text-[13px] text-muted">
          {formatDate(new Date().toISOString())}
          {meta ? ` · ${meta.organizationName}` : ''}
        </Text>
      </View>

      <View className="px-5 pt-5">
        {actionError ? <ErrorNote message={actionError} /> : null}
        {syncMessage ? <Notice tone="success">{syncMessage}</Notice> : null}
        {queueEvents.length ? (
          <Notice tone="warn">
            {queueEvents.length} clock event{queueEvents.length === 1 ? '' : 's'} saved on this device and waiting
            to sync.{' '}
            <Text className="font-semibold text-amber" onPress={() => void syncNow()}>
              {busy === 'sync' ? 'Sending…' : 'Sync now'}
            </Text>
          </Notice>
        ) : null}

        {receipt ? (
          <Card className="mb-4 overflow-hidden p-0">
            <View className="items-center bg-cobalt-soft px-5 pb-5 pt-6">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-white" style={shadowSoft}>
                <IconCheck size={30} color="#2457D6" strokeWidth={2.4} />
              </View>
              <Badge tone="blue">Shift complete</Badge>
              <Text className="mt-2 text-[22px] font-bold tracking-[-0.4px] text-ink">Shift recorded</Text>
              <Text className="mt-1 text-[12.5px] text-muted">
                {formatDate(receipt.endedAt)} · {receipt.workedMinutes != null ? 'synced to your owner' : 'saved'}
              </Text>
            </View>
            <View className="p-5">
              <View className="flex-row items-end justify-between">
                <View>
                  <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-faint">Payable time</Text>
                  <Text className="mt-1 text-[30px] font-bold leading-8 tracking-[-0.6px] text-ink">
                    {humanDuration(receipt.workedMinutes)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[12px] text-muted">{formatClock(receipt.startedAt)}</Text>
                  <Text className="text-[12px] text-muted">{formatClock(receipt.endedAt)}</Text>
                </View>
              </View>
              {receipt.reviewReason ? (
                <Text className="mt-3 text-[12px] leading-5 text-amber">{receipt.reviewReason}</Text>
              ) : null}
              <View className="mt-4 flex-row gap-2">
                <View className="flex-1">
                  <Button label="Dismiss" variant="secondary" size="sm" onPress={() => setReceipt(null)} />
                </View>
                <View className="flex-1">
                  <Button
                    label="View in history"
                    size="sm"
                    onPress={() => router.push('/history')}
                  />
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        {pendingClockOut && localShift ? (
          <Card className="p-5">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-cobalt-soft">
                <IconClock size={18} color="#2457D6" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-bold text-ink">Finishing your shift</Text>
                <Text className="mt-1 text-[13px] leading-5 text-muted">
                  Your clock-out at {localShift.siteName} is saved on this device. Go online and sync to close the
                  shift and see your receipt.
                </Text>
                <View className="mt-3">
                  <Button
                    label="Sync now"
                    variant="secondary"
                    loading={busy === 'sync'}
                    onPress={() => void syncNow()}
                  />
                </View>
              </View>
            </View>
          </Card>
        ) : working && localShift && active ? (
          <View className="gap-4">
            <HeroCard>
              <View className="p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-[#8FB4FF]" />
                    <Text className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-white">
                      Shift active
                    </Text>
                  </View>
                  {presenceBadge(active.presence)}
                </View>
                <View className="mt-5 flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-[12px] text-[#AEBBD4]">Time since clock-in</Text>
                    <Text className="mt-1 text-[38px] font-bold leading-[44px] tracking-[-0.8px] text-white">
                      {humanDuration(elapsedMinutes)}
                    </Text>
                    <Text className="mt-1 text-[11.5px] text-[#8FA3C8]">{active.siteName}</Text>
                  </View>
                  <ProgressRing progress={shiftProgress} size={86} stroke={8}>
                    <View className="items-center">
                      <Text className="text-[10px] text-[#AEBBD4]">of shift</Text>
                      <Text className="text-[15px] font-bold text-white">{Math.round(shiftProgress * 100)}%</Text>
                    </View>
                  </ProgressRing>
                </View>
                <View className="mt-5 flex-row items-center justify-between rounded-[18px] bg-white/10 px-4 py-3">
                  <View>
                    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#8FA3C8]">Started</Text>
                    <Text className="mt-1 text-[14px] font-semibold text-white">
                      {formatClock(active.startedAt, active.timezone)}
                    </Text>
                  </View>
                  <View className="h-8 w-px bg-white/10" />
                  <View>
                    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#8FA3C8]">
                      Expected end
                    </Text>
                    <Text className="mt-1 text-[14px] font-semibold text-white">{schedule?.end ?? 'Not set'}</Text>
                  </View>
                  <View className="h-8 w-px bg-white/10" />
                  <View>
                    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#8FA3C8]">Radius</Text>
                    <Text className="mt-1 text-[14px] font-semibold text-white">{selectedSite?.radiusMeters ?? 150} m</Text>
                  </View>
                </View>
              </View>
            </HeroCard>

            <Card className="p-4">
              <View className="flex-row items-center gap-3">
                <IconTile tone="blue">
                  <IconPin size={18} color="#2457D6" />
                </IconTile>
                <View className="flex-1">
                  <Text className="text-[10.5px] font-bold uppercase tracking-[1.1px] text-faint">
                    Assigned worksite
                  </Text>
                  <Text className="mt-0.5 text-[15px] font-bold text-ink">{active.siteName}</Text>
                  <Text className="mt-0.5 text-[11.5px] leading-4 text-muted" numberOfLines={1}>
                    {selectedSite?.address ?? 'Site record'}
                  </Text>
                </View>
                {reviewBadge(active.reviewState)}
              </View>

              <View className="mt-3 rounded-[18px] bg-[#F1F5FB] px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <IconShield size={15} color="#2457D6" />
                    <Text className="text-[12.5px] font-semibold text-ink">Site presence</Text>
                  </View>
                  <Text className="text-[11px] font-medium text-muted">
                    {tracking ? 'Background checks on' : 'Background checks off'}
                  </Text>
                </View>
                <Text className="mt-1 text-[11.5px] leading-4 text-muted">
                  {active.lastLocationUpdateAt
                    ? `Last verified ${relativeTime(active.lastLocationUpdateAt)}`
                    : 'Waiting for the first location check'}
                  {' · '}inside {selectedSite?.radiusMeters ?? 150} m geofence
                </Text>
              </View>

              {!tracking ? (
                <Pressable
                  onPress={async () => {
                    const started = await startTracking();
                    setTracking(started.tracking);
                  }}
                  className="mt-3 flex-row items-center gap-2 rounded-[16px] bg-amber-soft px-3.5 py-3"
                >
                  <IconAlert size={15} />
                  <Text className="flex-1 text-[12px] leading-4 text-amber">
                    Background checks are off. Turn them on so your owner can see you are on site.
                  </Text>
                  <IconChevronRight size={14} color="#B54708" />
                </Pressable>
              ) : null}
            </Card>

            <Card className="p-4">
              <Field label="Note for your owner" optional hint="Anything they should know about this shift.">
                <Input
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Worked through the site handover"
                  multiline
                  numberOfLines={2}
                  maxLength={500}
                  className={undefined}
                  style={{ height: 68, paddingTop: 12, textAlignVertical: 'top', backgroundColor: '#F5F7FB' }}
                />
              </Field>
              <Button
                label={localShift.shiftId ? 'Clock out' : 'Syncing your clock-in…'}
                variant="navy"
                size="lg"
                loading={busy === 'out'}
                onPress={() => setConfirmingOut(true)}
                disabled={busy !== null || !localShift.shiftId}
              />
            </Card>

            <Card className="px-4 py-1">
              <View className="flex-row items-center justify-between py-3">
                <Text className="text-[12.5px] text-muted">Shift telemetry</Text>
                <Text className="text-[11px] font-semibold text-cobalt">
                  {queueEvents.length ? `${queueEvents.length} pending` : 'Real-time sync'}
                </Text>
              </View>
              <View className="h-px w-full bg-line" />
              <View className="flex-row items-center justify-between py-3">
                <Text className="text-[12.5px] text-muted">Logged location</Text>
                <Text className="max-w-[60%] text-right text-[12.5px] font-semibold text-ink" numberOfLines={1}>
                  {active.siteName}
                </Text>
              </View>
              <View className="h-px w-full bg-line" />
              <View className="flex-row items-center justify-between py-3">
                <Text className="text-[12.5px] text-muted">Sync status</Text>
                <Badge tone={queueEvents.length ? 'amber' : 'blue'}>
                  {queueEvents.length ? 'Waiting to sync' : 'All events synced'}
                </Badge>
              </View>
            </Card>
          </View>
        ) : active ? (
          <Card className="p-5">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-soft">
                <IconAlert size={18} />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-bold text-ink">Clocked in elsewhere</Text>
                <Text className="mt-1 text-[13px] leading-5 text-muted">
                  Your shift at {active.siteName} started {formatClock(active.startedAt, active.timezone)}. It was
                  started on a different device or this app was reinstalled, so this device cannot end it.
                </Text>
                <Text className="mt-2 text-[12px] leading-4 text-faint">
                  Ask your site owner for a time correction once you have finished work.
                </Text>
                <View className="mt-3 flex-row items-center gap-2">
                  {presenceBadge(active.presence)}
                  {reviewBadge(active.reviewState)}
                </View>
              </View>
            </View>
          </Card>
        ) : pendingClockIn ? (
          <Card className="p-5">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-cobalt-soft">
                <IconClock size={18} color="#2457D6" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-bold text-ink">Clock-in saved</Text>
                <Text className="mt-1 text-[13px] leading-5 text-muted">
                  Your clock-in{localShift ? ` at ${localShift.siteName}` : ''} is encrypted on this device and will
                  reach your owner when the connection returns.
                </Text>
                <View className="mt-3">
                  <Button
                    label="Sync now"
                    variant="secondary"
                    loading={busy === 'sync'}
                    onPress={() => void syncNow()}
                  />
                </View>
              </View>
            </View>
          </Card>
        ) : (
          <View className="gap-4">
            {sites.length ? (
              <>
                {sites.length > 1 ? (
                  <>
                    <SectionTitle>Choose your site</SectionTitle>
                    <Card className="overflow-hidden p-2">
                      {sites.map((site, index) => {
                        const selected = selectedSite?.id === site.id;
                        return (
                          <View key={site.id}>
                            <Pressable
                              onPress={() => {
                                setSelectedSiteId(site.id);
                                setReading(null);
                              }}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              className={
                                selected
                                  ? 'flex-row items-center gap-3 rounded-[18px] bg-cobalt-soft px-3 py-3'
                                  : 'flex-row items-center gap-3 rounded-[18px] px-3 py-3'
                              }
                            >
                              <View
                                className={
                                  selected
                                    ? 'h-5 w-5 items-center justify-center rounded-full bg-cobalt'
                                    : 'h-5 w-5 rounded-full border-2 border-[#c3ccdb]'
                                }
                              >
                                {selected ? <IconCheck size={12} color="#FFFFFF" strokeWidth={2.6} /> : null}
                              </View>
                              <View className="flex-1">
                                <Text className="text-[13.5px] font-semibold text-ink">{site.name}</Text>
                                <Text className="mt-0.5 text-[11.5px] text-muted" numberOfLines={1}>
                                  {site.address}
                                </Text>
                              </View>
                              <Badge tone={selected ? 'blue' : 'slate'}>{site.radiusMeters} m</Badge>
                              {site.assignmentAcceptedAt === null ? <Badge tone="amber">Accept</Badge> : null}
                            </Pressable>
                            {index < sites.length - 1 ? <View className="mx-3 h-px bg-line" /> : null}
                          </View>
                        );
                      })}
                    </Card>
                  </>
                ) : null}

                <Card className="p-5">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full bg-cobalt" />
                      <Text className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-faint">
                        Assigned location
                      </Text>
                    </View>
                    <Badge tone="blue">Site verified</Badge>
                  </View>
                  <Text className="mt-3 text-[21px] font-bold leading-7 tracking-[-0.3px] text-ink">
                    {selectedSite?.name ?? 'No site selected'}
                  </Text>
                  <Text className="mt-1 text-[12.5px] leading-5 text-muted">{selectedSite?.address}</Text>

                  {selectedSite && selectedSite.assignmentAcceptedAt === null ? (
                    <Pressable
                      onPress={() => router.push(`/sites/${selectedSite.id}`)}
                      className="mt-3 flex-row items-start gap-2 rounded-[16px] bg-amber-soft px-3.5 py-3"
                    >
                      <IconAlert size={15} />
                      <Text className="flex-1 text-[12px] leading-4 text-amber">
                        Accept your site assignment before you can clock in. Tap to review and accept.
                      </Text>
                      <IconChevronRight size={14} color="#B54708" />
                    </Pressable>
                  ) : null}

                  <View className="mt-4 flex-row gap-2.5">
                    <View className="flex-1 rounded-[18px] bg-[#F1F5FB] p-3.5">
                      <Text className="text-[9.5px] font-bold uppercase tracking-[1px] text-faint">
                        Shift window
                      </Text>
                      <Text className="mt-1 text-[14px] font-bold text-ink">
                        {schedule ? `${schedule.start} – ${schedule.end}` : 'Flexible'}
                      </Text>
                      <Text className="mt-0.5 text-[10.5px] text-muted">
                        {schedule
                          ? schedule.days.length >= 7
                            ? 'Every day'
                            : schedule.days.length === 5
                              ? 'Monday – Friday'
                              : `${schedule.days.length} days a week`
                          : 'Clock in when you arrive'}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-[18px] bg-[#F1F5FB] p-3.5">
                      <Text className="text-[9.5px] font-bold uppercase tracking-[1px] text-faint">Geofence</Text>
                      <Text className="mt-1 text-[14px] font-bold text-ink">{selectedSite?.radiusMeters ?? 150} m radius</Text>
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <IconShield size={10} color="#2457D6" />
                        <Text className="text-[10.5px] text-muted">Precision checked</Text>
                      </View>
                    </View>
                  </View>

                  <View className="mt-4 rounded-[18px] bg-cobalt-soft px-4 py-3">
                    <View className="flex-row items-center gap-2">
                      <IconPin size={15} color="#2457D6" />
                      <Text className="text-[12.5px] font-semibold text-ink">
                        {permission === 'granted'
                          ? 'Location verified at the site'
                          : permission === 'foreground-only'
                            ? 'Location works while Manage is open'
                            : permission === 'denied'
                              ? 'Location permission is off'
                              : 'Location permission needed'}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[11.5px] leading-4 text-muted">
                      {measured && reading && selectedSite
                        ? `About ${measured} away · GPS accuracy ±${Math.round(reading.accuracyMeters)} m · ${formatClock(reading.capturedAt)}`
                        : permission === 'granted'
                          ? 'Manage checks your position about once a minute while you are clocked in.'
                          : 'Manage uses your location only to confirm you are at the site during a shift.'}
                    </Text>
                    <Pressable
                      onPress={() => void (permission !== 'granted' ? enableLocation() : checkLocation())}
                      className="mt-2"
                    >
                      <Text className="text-[12px] font-semibold text-cobalt">
                        {busy === 'permission'
                          ? 'Requesting…'
                          : busy === 'check'
                            ? 'Checking…'
                            : permission !== 'granted'
                              ? 'Allow location'
                              : 'Check my location now'}
                      </Text>
                    </Pressable>
                  </View>

                  {selectedSite ? (
                    <Pressable
                      onPress={() => router.push(`/sites/${selectedSite.id}`)}
                      className="mt-3 flex-row items-center justify-center gap-1.5"
                    >
                      <Text className="text-[12px] font-semibold text-cobalt">View site details</Text>
                      <IconChevronRight size={14} color="#2457D6" />
                    </Pressable>
                  ) : null}
                </Card>

                <Card className="p-5">
                  <Field label="Note" optional hint="Shared with your site owner.">
                    <Input
                      value={note}
                      onChangeText={setNote}
                      placeholder="e.g. Covering the early shift"
                      multiline
                      numberOfLines={2}
                      maxLength={500}
                      className={undefined}
                      style={{ height: 64, paddingTop: 12, textAlignVertical: 'top', backgroundColor: '#F5F7FB' }}
                    />
                  </Field>
                  <Button
                    label={
                      selectedSite?.assignmentAcceptedAt === null
                        ? 'Accept the assignment first'
                        : selectedSite
                          ? `Clock in at ${selectedSite.name}`
                          : 'Clock in'
                    }
                    size="lg"
                    loading={busy === 'in'}
                    onPress={() => void clockIn()}
                    disabled={!selectedSite || busy !== null || selectedSite.assignmentAcceptedAt === null}
                    icon={<IconClock size={18} color="#FFFFFF" />}
                  />
                </Card>

                <View className="flex-row items-start gap-2 px-1">
                  <IconInfo size={14} />
                  <Text className="flex-1 text-[11.5px] leading-4 text-faint">
                    One location reading is taken now. If GPS is weak, the clock-in is kept and flagged for your
                    owner to review rather than guessed.
                  </Text>
                </View>
              </>
            ) : (
              <Card>
                <EmptyState
                  icon={<IconPin size={20} />}
                  title="No site assigned yet"
                  body="Your owner needs to assign you to a site before you can clock in. Ask them to add you from the Team screen."
                />
              </Card>
            )}
          </View>
        )}

        {!receipt && !active && resource.data?.shift.lastEndedShift ? (
          <Pressable
            onPress={() => router.push(`/history/${resource.data?.shift.lastEndedShift?.id ?? ''}`)}
            className="mt-4"
          >
            <Card className="flex-row items-center gap-3 p-4">
              <IconTile tone="canvas">
                <IconClock size={17} />
              </IconTile>
              <View className="flex-1">
                <Text className="text-[10.5px] font-bold uppercase tracking-[1.1px] text-faint">Last shift</Text>
                <Text className="mt-0.5 text-[13.5px] font-semibold text-ink">
                  {resource.data.shift.lastEndedShift.siteName} ·{' '}
                  {humanDuration(resource.data.shift.lastEndedShift.durationMinutes)}
                </Text>
                <Text className="mt-0.5 text-[11.5px] text-muted">
                  {formatDate(resource.data.shift.lastEndedShift.endedAt)} ·{' '}
                  {formatClock(resource.data.shift.lastEndedShift.startedAt)} →{' '}
                  {formatClock(resource.data.shift.lastEndedShift.endedAt)}
                </Text>
              </View>
              <IconChevronRight size={16} />
            </Card>
          </Pressable>
        ) : null}

        {onboarding && !onboarding.completedAt ? (
          <Pressable onPress={() => router.push('/onboarding')} className="mt-4">
            <Card className="flex-row items-center gap-3 p-4">
              <IconTile tone="blue">
                <IconInfo size={17} color="#2457D6" />
              </IconTile>
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-ink">Getting started</Text>
                <Text className="mt-0.5 text-[11.5px] text-muted">
                  {onboardingDone} of 3 steps done · {3 - onboardingDone} left
                </Text>
              </View>
              <IconChevronRight size={16} color="#2457D6" />
            </Card>
          </Pressable>
        ) : null}

        <View className="mt-6 flex-row items-center justify-center gap-1.5">
          <IconClock size={12} color="#98A4B8" />
          <Text className="text-[11px] text-faint">
            Server time {resource.data ? formatClock(resource.data.shift.serverTime) : '—'}
          </Text>
        </View>
      </View>

      <Modal
        visible={confirmingOut && Boolean(localShift)}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmingOut(false)}
      >
        <View className="flex-1 justify-end bg-[#101D35]/45">
          <Pressable className="flex-1" accessibilityLabel="Close" onPress={() => setConfirmingOut(false)} />
          <View className="rounded-t-[30px] bg-white px-5 pb-8 pt-3" style={shadowFloat}>
            <View className="mx-auto h-1.5 w-12 rounded-full bg-line" />
            <View className="mt-5 flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-[26px] font-bold tracking-[-0.4px] text-ink">End your shift?</Text>
                <Text className="mt-1 text-[13px] leading-5 text-muted">
                  Your location checks stop immediately when you clock out.
                </Text>
              </View>
              <Pressable
                onPress={() => setConfirmingOut(false)}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F5FB]"
              >
                <IconX size={16} />
              </Pressable>
            </View>

            <View className="mt-4 rounded-[20px] bg-[#F1F5FB] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-[9.5px] font-bold uppercase tracking-[1.1px] text-faint">
                  Worksite & operative
                </Text>
                <Text className="text-[10.5px] text-muted">{formatDate(new Date().toISOString())}</Text>
              </View>
              <View className="mt-2 flex-row items-center gap-2">
                <IconPin size={15} color="#2457D6" />
                <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>
                  {localShift?.siteName ?? active?.siteName}
                </Text>
              </View>
              <Text className="mt-0.5 pl-[23px] text-[11.5px] text-muted">
                {me?.user.name}
                {meta ? ` · ${meta.organizationName}` : ''}
              </Text>

              <View className="my-3 h-px w-full bg-[#DCE4F0]" />

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-faint">Started</Text>
                  <Text className="mt-0.5 text-[13px] font-semibold text-ink">
                    {active ? formatClock(active.startedAt, active.timezone) : '—'}
                  </Text>
                </View>
                <View>
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-faint">Duration</Text>
                  <Text className="mt-0.5 text-[13px] font-semibold text-ink">{humanDuration(elapsedMinutes)}</Text>
                </View>
              </View>

              <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-white px-3 py-2">
                <IconCheck size={12} color="#2457D6" strokeWidth={2.4} />
                <Text className="flex-1 text-[11.5px] font-semibold text-ink">
                  Inside site boundary
                </Text>
                <Text className="text-[10.5px] text-muted">Verified</Text>
              </View>
            </View>

            <View className="mt-4 gap-2.5">
              <Button
                label="Clock out"
                variant="navy"
                size="lg"
                loading={busy === 'out'}
                onPress={() => {
                  setConfirmingOut(false);
                  void clockOut();
                }}
                icon={<IconLogout size={18} color="#FFFFFF" />}
              />
              <Button label="Keep working" variant="secondary" size="lg" onPress={() => setConfirmingOut(false)} />
            </View>
            <Text className="mt-3 text-center text-[10.5px] text-faint">
              Syncs automatically to {meta?.organizationName ?? 'your organization'} attendance log
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
