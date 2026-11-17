import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { InvitationSummary, SiteSummary } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useApiResource } from '@/lib/hooks';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorNote,
  Field,
  Header,
  Input,
  Loading,
  Notice,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { IconCheck, IconInfo, IconMail, IconUsers } from '@/components/icons';

type Data = { sites: SiteSummary[]; invitations: InvitationSummary[] };

export default function InviteMemberScreen() {
  const router = useRouter();
  const resource = useApiResource<Data>(async () => {
    const [sites, invitations] = await Promise.all([api.sites('current'), api.teamInvitations()]);
    return { sites, invitations };
  });
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; token: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setIssued(null);
    try {
      const result = await api.inviteTeamMember({
        email: email.trim().toLowerCase(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(siteId ? { siteId } : {}),
      });
      setEmail('');
      setNote('');
      if (result.developmentToken) {
        setIssued({ email: result.invitation.email, token: result.developmentToken });
      }
      resource.reload();
    } catch (cause) {
      setError(messageOf(cause, 'The invitation could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const share = async (token: string) => {
    const url = `${WEB_URL}/invite?token=${encodeURIComponent(token)}`;
    await Share.share({
      message: `You are invited to the Manage team.\n\nOpen this link to set up your account (single use, expires in seven days):\n${url}`,
    });
  };

  const revoke = (invitation: InvitationSummary) => {
    Alert.alert(
      'Revoke this invitation?',
      `${invitation.email} will not be able to use the link.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevoking(invitation.id);
            setError(null);
            try {
              await api.revokeTeamInvitation(invitation.id);
              resource.reload();
            } catch (cause) {
              setError(messageOf(cause, 'The invitation could not be revoked.'));
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Add member" onBack={() => router.back()} />
        <Loading label="Loading your team" />
      </Screen>
    );
  }

  const data = resource.data ?? { sites: [], invitations: [] };
  const chosenSite = data.sites.find((site) => site.id === siteId) ?? null;
  const pending = data.invitations.filter((invitation) => invitation.status === 'PENDING');

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Invitation only"
        title="Add a team member"
        subtitle="Choose a site, or invite them to the general team first."
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {error ? <ErrorNote message={error} /> : null}

        {issued ? (
          <Card className="mb-3 border-cobalt-border bg-[#F8FAFF] p-4">
            <Text className="text-[13.5px] font-bold text-ink">Invitation ready for {issued.email}</Text>
            <Text className="mt-1 text-[11.5px] leading-4 text-muted">
              Email delivery is running on the local development adapter, so the API returned the link directly.
              Share it securely — it is single use and expires in seven days.
            </Text>
            <View className="mt-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
              <Text className="text-[11px] leading-4 text-muted" selectable>
                {`${WEB_URL}/invite?token=${issued.token}`}
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Button label="Share link" onPress={() => void share(issued.token)} />
              </View>
              <View className="flex-1">
                <Button label="Done" variant="secondary" onPress={() => setIssued(null)} />
              </View>
            </View>
          </Card>
        ) : null}

        <SectionTitle>Where should they start?</SectionTitle>
        <Card className="p-4">
          <Button
            label={siteId === null ? 'General team ✓' : 'General team'}
            variant={siteId === null ? 'primary' : 'secondary'}
            onPress={() => setSiteId(null)}
          />
          <Text className="mt-2 text-[11.5px] leading-4 text-muted">
            General members can sign in, but cannot clock in until you assign them to a site.
          </Text>
          {data.sites.length ? (
            <>
              <Divider />
              <Text className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-[1px] text-faint">
                Assign to a site now
              </Text>
              <View className="gap-2">
                {data.sites.map((site) => (
                  <Button
                    key={site.id}
                    label={`${site.name}${siteId === site.id ? ' ✓' : ''}`}
                    variant={siteId === site.id ? 'primary' : 'secondary'}
                    onPress={() => setSiteId(site.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        <SectionTitle>Invitation</SectionTitle>
        <Card className="p-4">
          <Field label="Work email" hint="They join only through this single-use link.">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>
          <Field label="Note" optional hint="Included in the invitation email.">
            <Input value={note} onChangeText={setNote} placeholder="Joining the night shift" maxLength={300} />
          </Field>
          <Button
            label={chosenSite ? `Invite to ${chosenSite.name}` : 'Invite to the general team'}
            loading={busy}
            onPress={() => void invite()}
            disabled={busy || !email.trim()}
            icon={<IconMail size={16} color="#FFFFFF" />}
          />
        </Card>

        <View className="mt-4">
          <Notice>
            Nobody can enroll themselves. Accounts are created only by accepting an invitation, and owners can
            revoke a link before it is used.
          </Notice>
        </View>

        <SectionTitle
          right={pending.length ? <Badge tone="amber">{pending.length} pending</Badge> : undefined}
        >
          General team invitations
        </SectionTitle>
        {pending.length ? (
          <View className="gap-2">
            {pending.map((invitation) => (
              <Card key={invitation.id} className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-soft">
                    <IconMail size={16} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink">{invitation.email}</Text>
                    <Text className="mt-0.5 text-[11.5px] text-muted">
                      {invitation.siteName ?? 'General team'} · sent {formatDate(invitation.createdAt)}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-faint">
                      Expires {formatDateTime(invitation.expiresAt)}
                    </Text>
                  </View>
                  <Button
                    label={revoking === invitation.id ? 'Revoking…' : 'Revoke'}
                    variant="secondary"
                    onPress={() => revoke(invitation)}
                    disabled={revoking !== null}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={<IconUsers size={20} />}
              title="No general invitations waiting"
              body="Site invitations appear on each site's Invites tab. General invites without a site appear here."
            />
          </Card>
        )}

        <View className="mt-4 flex-row items-start gap-2">
          <IconInfo size={13} />
          <Text className="flex-1 text-[11px] leading-4 text-faint">
            Invitations expire after seven days. Revoking a link never deletes existing attendance records.
          </Text>
        </View>
        <View className="mt-3">
          <Button
            label="Back to team"
            variant="secondary"
            onPress={() => router.back()}
            icon={<IconCheck size={16} color="#14213D" />}
          />
        </View>
      </View>
    </Screen>
  );
}
