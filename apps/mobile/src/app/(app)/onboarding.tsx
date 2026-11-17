import { useState, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { OnboardingState } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  Header,
  Loading,
  Notice,
  ProgressRing,
  Screen,
  SectionTitle,
} from '@/components/ui';
import {
  IconAlert,
  IconBell,
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInfo,
  IconPin,
  IconShield,
  IconUsers,
  type IconProps,
} from '@/components/icons';

type StepKey =
  | 'detailsConfirmed'
  | 'siteReviewed'
  | 'readinessCompleted'
  | 'siteDetailsDone'
  | 'boundaryDone'
  | 'inviteDone'
  | 'alertsReviewed';

type Step = {
  key: StepKey;
  title: string;
  body: string;
  route: string;
  action: string;
  icon: ComponentType<IconProps>;
};

const OWNER_STEPS: Step[] = [
  {
    key: 'siteDetailsDone',
    title: 'Add site details',
    body: 'Name each worksite, add its address and timezone, and set the expected working hours.',
    route: '/sites',
    action: 'Open sites',
    icon: IconBuilding,
  },
  {
    key: 'boundaryDone',
    title: 'Set the site boundary',
    body: 'Choose the radius, exit and entry buffers, and the grace period. Clock-in is checked against this boundary.',
    route: '/sites',
    action: 'Review boundaries',
    icon: IconPin,
  },
  {
    key: 'inviteDone',
    title: 'Invite your team',
    body: 'Staff join by invitation only. Open a site, invite their email, then assign them to the site.',
    route: '/sites',
    action: 'Open a site',
    icon: IconUsers,
  },
  {
    key: 'alertsReviewed',
    title: 'Review a departure alert',
    body: 'Acknowledge, contact, or dismiss an alert so your team knows the inbox is being watched.',
    route: '/alerts',
    action: 'Open alerts',
    icon: IconBell,
  },
];

const STAFF_STEPS: Step[] = [
  {
    key: 'detailsConfirmed',
    title: 'Check your details',
    body: 'Confirm your name, email, and sign-in security on the Account tab.',
    route: '/account',
    action: 'Open account',
    icon: IconShield,
  },
  {
    key: 'siteReviewed',
    title: 'Review your assigned site',
    body: 'Open Today to see the worksite name, boundary, and expected hours before your first shift.',
    route: '/',
    action: 'Open Today',
    icon: IconBuilding,
  },
  {
    key: 'readinessCompleted',
    title: 'Complete your readiness check',
    body: 'Allow location access while using the app, keep the phone charged, and clock in from inside the site.',
    route: '/',
    action: 'Go to Today',
    icon: IconClock,
  },
];

const OWNER_KEYS: StepKey[] = ['siteDetailsDone', 'boundaryDone', 'inviteDone', 'alertsReviewed'];
const STAFF_KEYS: StepKey[] = ['detailsConfirmed', 'siteReviewed', 'readinessCompleted'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { isOwner, isStaff } = useAuth();
  const resource = useApiResource<OnboardingState>(() => api.onboarding());
  const [busy, setBusy] = useState<StepKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Workspace setup" onBack={() => router.back()} />
        <Loading label="Loading your checklist" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Workspace setup" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const data = resource.data;
  if (!data) return null;

  const mode = isOwner ? 'owner' : isStaff ? 'staff' : 'none';

  if (mode === 'none') {
    return (
      <Screen>
        <Header title="Workspace setup" onBack={() => router.back()} />
        <View className="p-4">
          <Card>
            <EmptyState
              icon={<IconInfo size={20} />}
              title="Setup is for staff and site owners"
              body="Platform administrators manage organizations and users from the web console; there is no personal setup checklist here."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  const steps = mode === 'owner' ? OWNER_STEPS : STAFF_STEPS;
  const keys = mode === 'owner' ? OWNER_KEYS : STAFF_KEYS;
  const flags: Record<string, boolean> =
    mode === 'owner'
      ? {
          siteDetailsDone: data.owner.siteDetailsDone,
          boundaryDone: data.owner.boundaryDone,
          inviteDone: data.owner.inviteDone,
          alertsReviewed: data.owner.alertsReviewed,
        }
      : {
          detailsConfirmed: data.staff.detailsConfirmed,
          siteReviewed: data.staff.siteReviewed,
          readinessCompleted: data.staff.readinessCompleted,
        };
  const doneCount = keys.filter((key) => flags[key]).length;
  const total = keys.length;
  const complete = doneCount === total;
  const completedAt = mode === 'owner' ? data.owner.completedAt : data.staff.completedAt;

  const toggle = async (step: StepKey) => {
    setBusy(step);
    setError(null);
    setSaved(null);
    try {
      const next = await api.updateOnboarding(step, !flags[step]);
      resource.setData(next);
      setSaved(flags[step] ? 'Step reopened.' : 'Step marked done.');
    } catch (cause) {
      setError(messageOf(cause, 'The checklist could not be updated.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Setup"
        title="Workspace setup"
        subtitle={
          mode === 'owner'
            ? 'Four steps to get your first worksite running'
            : 'Three steps before your first clock-in'
        }
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {error ? <ErrorNote message={error} onRetry={resource.reload} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-faint">Progress</Text>
              <Text className="mt-1 text-[26px] font-bold tracking-[-0.5px] text-ink">
                {doneCount} of {total}
              </Text>
              <View className="mt-2">
                {complete ? <Badge tone="blue">Complete</Badge> : <Badge tone="amber">In progress</Badge>}
              </View>
            </View>
            <ProgressRing
              progress={doneCount / total}
              size={68}
              stroke={7}
              color="#2457D6"
              track="#E9EEF7"
            >
              <Text className="text-[13px] font-bold text-ink">
                {Math.round((doneCount / total) * 100)}%
              </Text>
            </ProgressRing>
          </View>
          <Text className="mt-3 text-[11.5px] leading-4 text-muted">
            {completedAt
              ? `Completed ${formatDateTime(completedAt)}. You can reopen any step.`
              : complete
                ? 'All steps are done. The checklist is marked complete automatically.'
                : `${total - doneCount} step${total - doneCount === 1 ? '' : 's'} left. You can come back anytime.`}
          </Text>
        </Card>

        {complete ? (
          <View className="mt-3">
            <Notice tone="success">
              Setup is complete. The product keeps enforcing invitations, MFA, and site boundaries regardless
              of this checklist.
            </Notice>
          </View>
        ) : null}

        <SectionTitle>Checklist</SectionTitle>
        <View className="gap-2.5">
          {steps.map((step) => {
            const done = Boolean(flags[step.key]);
            const Icon = step.icon;
            return (
              <Card key={step.key} className={`p-4 ${done ? 'border-cobalt-border' : ''}`}>
                <View className="flex-row items-start gap-3">
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-xl ${
                      done ? 'bg-cobalt' : 'bg-cobalt-soft'
                    }`}
                  >
                    {done ? (
                      <IconCheck size={18} color="#FFFFFF" />
                    ) : (
                      <Icon size={18} color="#2457D6" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-ink">{step.title}</Text>
                    <Text className="mt-1 text-[12px] leading-4 text-muted">{step.body}</Text>
                  </View>
                </View>

                <View className="mt-3 flex-row items-center justify-between">
                  <Pressable
                    onPress={() => router.push(step.route)}
                    hitSlop={8}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-[12.5px] font-semibold text-cobalt">{step.action}</Text>
                    <IconChevronRight size={13} color="#2457D6" />
                  </Pressable>

                  <Pressable
                    onPress={() => void toggle(step.key)}
                    disabled={busy !== null}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done, disabled: busy !== null }}
                    className={`rounded-lg border px-3 py-1.5 ${
                      done ? 'border-cobalt-border bg-cobalt-soft' : 'border-line-strong bg-white'
                    } ${busy === step.key ? 'opacity-60' : ''}`}
                  >
                    <Text
                      className={`text-[11.5px] font-semibold ${done ? 'text-cobalt' : 'text-muted'}`}
                    >
                      {busy === step.key ? 'Saving…' : done ? 'Done · undo' : 'Mark done'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>

        <View className="mt-4 flex-row items-start gap-2 rounded-xl border border-line bg-white px-3.5 py-3">
          <IconAlert size={14} />
          <Text className="flex-1 text-[11.5px] leading-4 text-muted">
            This checklist records readiness; it does not grant access. Invitations, MFA enforcement, and
            server-side scope checks are always on.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
