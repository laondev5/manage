import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Role } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDateTime, relativeTime } from '@/lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  ErrorNote,
  Header,
  IconTile,
  Loading,
  Notice,
  Screen,
  SectionTitle,
  shadowSoft,
} from '@/components/ui';
import {
  IconChevronRight,
  IconClock,
  IconInfo,
  IconLock,
  IconLogout,
  IconMail,
  IconPin,
  IconRefresh,
  IconShield,
} from '@/components/icons';

const ROLE_LABEL: Record<Role, string> = {
  PLATFORM_ADMIN: 'Platform admin',
  SITE_OWNER: 'Site owner',
  STAFF: 'Staff',
};

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function windowLabel(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) return 'Mon–Fri';
  if (days.length === 6 && [1, 2, 3, 4, 5, 6].every((day) => days.includes(day))) return 'Mon–Sat';
  return days.map((day) => DAY_LABEL[day] ?? '').filter(Boolean).join(', ');
}

export default function AccountScreen() {
  const router = useRouter();
  const { me, isOwner, signOut, switchOrganization } = useAuth();
  const devices = useApiResource(() => api.devices());
  const sites = useApiResource(() => api.sites());
  const [busyOrg, setBusyOrg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (!me) {
    return (
      <Screen>
        <Header title="Account" />
        <Loading label="Loading your account" />
      </Screen>
    );
  }

  const membership = me.activeOrganizationId
    ? me.memberships.find((entry) => entry.organizationId === me.activeOrganizationId)
    : me.memberships[0];

  const switchTo = async (organizationId: string, name: string) => {
    setBusyOrg(organizationId);
    setError(null);
    setSwitchedTo(null);
    try {
      await switchOrganization(organizationId);
      setSwitchedTo(name);
      devices.reload();
      sites.reload();
    } catch (cause) {
      setError(messageOf(cause, 'The organization could not be changed.'));
    } finally {
      setBusyOrg(null);
    }
  };

  const revoke = (deviceId: string) => {
    Alert.alert(
      'Remove this device?',
      'Manage will stop registering this device for the account. You can sign in again on it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRevoking(deviceId);
            setError(null);
            try {
              await api.revokeDevice(deviceId);
              devices.reload();
            } catch (cause) {
              setError(messageOf(cause, 'The device could not be removed.'));
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out of Manage?',
      'Events waiting to sync on this device are cleared. Make sure your clock-in or clock-out has synced first.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
            router.replace('/sign-in');
          },
        },
      ],
    );
  };

  const activeDevices = (devices.data ?? []).filter((device) => !device.revokedAt);
  const assignedSites = sites.data ?? [];

  return (
    <Screen
      refreshing={devices.refreshing || sites.refreshing}
      onRefresh={() => {
        devices.refresh();
        sites.refresh();
      }}
    >
      <Header
        eyebrow="Your profile"
        title="Account"
        subtitle={membership?.organizationName ?? 'Manage attendance'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh account"
            onPress={() => {
              devices.refresh();
              sites.refresh();
            }}
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
        {switchedTo ? <Notice tone="success">Now working in {switchedTo}.</Notice> : null}

        <Card className="p-5">
          <View className="flex-row items-center gap-3.5">
            <Avatar name={me.user.name} size={58} tone="navy" />
            <View className="flex-1">
              <Text className="text-[19px] font-bold tracking-[-0.3px] text-ink" numberOfLines={1}>
                {me.user.name}
              </Text>
              <Text className="mt-0.5 text-[12.5px] text-muted" numberOfLines={1}>
                {ROLE_LABEL[membership?.role ?? 'STAFF']}
                {membership ? ` · ${membership.organizationName}` : ''}
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {membership ? <Badge tone="blue">{membership.organizationName}</Badge> : null}
                {me.user.twoFactorEnabled ? <Badge tone="navy">MFA on</Badge> : <Badge tone="amber">MFA off</Badge>}
              </View>
            </View>
          </View>

          <View className="my-4">
            <Divider />
          </View>

          <View className="flex-row items-start gap-2.5">
            <IconMail size={15} />
            <View className="flex-1">
              <Text className="text-[11px] font-bold uppercase tracking-[1px] text-faint">Work email</Text>
              <Text className="mt-0.5 text-[13px] font-semibold text-ink">{me.user.email}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center gap-2">
            {me.user.emailVerified ? (
              <Badge tone="blue">Email verified</Badge>
            ) : (
              <Badge tone="amber">Email unverified</Badge>
            )}
          </View>
        </Card>

        <SectionTitle>{isOwner ? 'Sites you oversee' : 'Assigned worksite'}</SectionTitle>
        {sites.loading && !sites.data ? (
          <Card className="p-5">
            <Text className="text-[12.5px] text-muted">Loading your sites…</Text>
          </Card>
        ) : sites.error ? (
          <ErrorNote message={sites.error} onRetry={sites.reload} />
        ) : assignedSites.length ? (
          <View className="gap-3">
            {assignedSites.map((site) => (
              <Pressable
                key={site.id}
                onPress={isOwner ? () => router.push(`/sites/${site.id}`) : undefined}
                accessibilityRole={isOwner ? 'button' : undefined}
              >
                <Card className="p-5">
                  <View className="flex-row items-center gap-3">
                    <IconTile tone="blue">
                      <IconPin size={18} color="#2457D6" />
                    </IconTile>
                    <View className="flex-1">
                      <Text className="text-[16.5px] font-bold tracking-[-0.2px] text-ink" numberOfLines={1}>
                        {site.name}
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
                        {site.address}
                      </Text>
                    </View>
                    {isOwner ? <IconChevronRight size={16} /> : null}
                  </View>

                  <View className="mt-4 flex-row gap-2">
                    <View className="flex-1 rounded-[16px] bg-[#F1F5FB] px-3.5 py-3">
                      <View className="flex-row items-center gap-1.5">
                        <IconClock size={12} />
                        <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-faint">
                          Shift window
                        </Text>
                      </View>
                      <Text className="mt-1 text-[13px] font-semibold text-ink">
                        {site.expectedHours
                          ? `${site.expectedHours.start}–${site.expectedHours.end}`
                          : 'Flexible'}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-muted">
                        {site.expectedHours ? windowLabel(site.expectedHours.days) : 'No fixed hours'}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-[16px] bg-[#F1F5FB] px-3.5 py-3">
                      <View className="flex-row items-center gap-1.5">
                        <IconPin size={12} />
                        <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-faint">
                          Geofence
                        </Text>
                      </View>
                      <Text className="mt-1 text-[13px] font-semibold text-ink">{site.radiusMeters} m</Text>
                      <Text className="mt-0.5 text-[11px] text-muted">Radius around site</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card className="flex-row items-center gap-3 p-5">
            <IconTile tone="amber">
              <IconPin size={18} color="#B54708" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">No site assigned yet</Text>
              <Text className="mt-0.5 text-[12px] leading-4 text-muted">
                Your owner assigns you to a worksite before you can clock in.
              </Text>
            </View>
          </Card>
        )}

        {me.memberships.length > 1 ? (
          <>
            <SectionTitle>Organizations</SectionTitle>
            <Card className="px-5">
              {me.memberships
                .filter((entry) => entry.status === 'ACTIVE')
                .map((entry, index, entries) => {
                  const active = entry.organizationId === me.activeOrganizationId;
                  return (
                    <View key={`${entry.organizationId}-${entry.role}`}>
                      <View className="flex-row items-center gap-3 py-3.5">
                        <View className="flex-1">
                          <Text className="text-[13.5px] font-semibold text-ink">{entry.organizationName}</Text>
                          <Text className="mt-0.5 text-[11.5px] text-muted">{ROLE_LABEL[entry.role]}</Text>
                        </View>
                        {active ? (
                          <Badge tone="blue">Current</Badge>
                        ) : (
                          <Pressable
                            onPress={() => void switchTo(entry.organizationId, entry.organizationName)}
                            hitSlop={8}
                            className="rounded-[12px] border border-line-strong px-3 py-1.5"
                          >
                            <Text className="text-[12px] font-semibold text-cobalt">
                              {busyOrg === entry.organizationId ? 'Switching…' : 'Switch'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      {index < entries.length - 1 ? <Divider /> : null}
                    </View>
                  );
                })}
            </Card>
          </>
        ) : null}

        <SectionTitle>Security</SectionTitle>
        <Card className="px-5">
          <Pressable
            onPress={me.user.twoFactorEnabled ? undefined : () => router.push('/mfa-setup')}
            className="flex-row items-center gap-3 py-4"
          >
            <IconTile tone="blue">
              <IconShield size={18} color="#2457D6" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">Two-factor authentication</Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                {me.user.twoFactorEnabled
                  ? 'An authenticator code is required at sign-in. Manage it in the web console.'
                  : isOwner
                    ? 'Required for site owners. Set it up now with an authenticator app.'
                    : 'Optional, but it protects your account if your password is exposed.'}
              </Text>
            </View>
            {me.user.twoFactorEnabled ? <Badge tone="blue">On</Badge> : <IconChevronRight size={16} />}
          </Pressable>

          <Divider />

          <View className="flex-row items-center gap-3 py-4">
            <IconTile tone="canvas">
              <IconLock size={18} />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">Password</Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                Reset from the sign-in screen. A reset signs other sessions out.
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle right={<Text className="text-[11.5px] text-muted">{activeDevices.length} active</Text>}>
          Devices
        </SectionTitle>
        <Card className="p-5">
          {devices.loading && !devices.data ? (
            <Text className="text-[12.5px] text-muted">Loading devices…</Text>
          ) : devices.error ? (
            <ErrorNote message={devices.error} onRetry={devices.reload} />
          ) : activeDevices.length ? (
            <View>
              {activeDevices.map((device, index) => (
                <View key={device.id}>
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-[13px] font-semibold capitalize text-ink">
                        {device.platform} device
                      </Text>
                      <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                        App {device.appVersion ?? 'unknown'} · last seen {relativeTime(device.lastSeenAt)} · added{' '}
                        {formatDateTime(device.createdAt)}
                      </Text>
                    </View>
                    <Pressable onPress={() => revoke(device.id)} hitSlop={8}>
                      <Text className="text-[12px] font-semibold text-danger">
                        {revoking === device.id ? 'Removing…' : 'Remove'}
                      </Text>
                    </Pressable>
                  </View>
                  {index < activeDevices.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-[12.5px] leading-5 text-muted">
              No active devices registered. Signing in on this phone registers it for secure sessions and push
              notifications.
            </Text>
          )}
          <View className="mt-3 flex-row items-start gap-2">
            <IconInfo size={13} />
            <Text className="flex-1 text-[11px] leading-4 text-faint">
              Removing a device revokes its registration only; other sessions stay signed in until they expire.
            </Text>
          </View>
        </Card>

        <SectionTitle>Workspace</SectionTitle>
        <Card className="px-5">
          <Pressable onPress={() => router.push('/intro?replay=1')} className="flex-row items-center gap-3 py-4">
            <IconTile tone="blue">
              <IconInfo size={18} color="#2457D6" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">How Manage works</Text>
              <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                Replay the four-step introduction: presence, alerts and evidence.
              </Text>
            </View>
            <IconChevronRight size={16} />
          </Pressable>
          {isOwner ? (
            <>
              <Divider />
              <Pressable onPress={() => router.push('/onboarding')} className="flex-row items-center gap-3 py-4">
                <IconTile tone="canvas">
                  <IconInfo size={18} />
                </IconTile>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-semibold text-ink">Workspace setup</Text>
                  <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
                    Site details, boundary, team invitations and alert review.
                  </Text>
                </View>
                <IconChevronRight size={16} />
              </Pressable>
            </>
          ) : null}
        </Card>

        <View className="mt-6">
          <Button
            label="Sign out"
            variant="danger"
            loading={signingOut}
            onPress={confirmSignOut}
            icon={<IconLogout size={17} color="#B42318" />}
          />
        </View>

        <Text className="mt-5 text-center text-[11px] leading-4 text-faint">
          Manage · corporate worksite attendance{'\n'}
          Session and device controls are logged in the audit trail.
        </Text>
      </View>
    </Screen>
  );
}
