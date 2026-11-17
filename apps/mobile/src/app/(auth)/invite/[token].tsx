import { useEffect, useState } from 'react';
import { Pressable, Text, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { publicApi, messageOf } from '@/lib/api';
import { authClient } from '@/lib/session';
import { useAuth } from '@/lib/auth';
import { Screen, Button, Field, Input, PasswordInput, ErrorNote, Notice, Card, Loading } from '@/components/ui';
import { IconMail } from '@/components/icons';
import { BrandLockup } from '@/components/brand';
import { formatDateTime } from '@/lib/format';
import { WEB_URL } from '@/lib/config';

type Preview = {
  email: string;
  siteName: string | null;
  organizationName: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  note: string | null;
};

export default function InviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { me, signOut } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      setLoadError('This invitation link is not valid.');
      return;
    }
    void publicApi
      .invitationPreview(token)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((cause) => {
        if (active) setLoadError(messageOf(cause, 'This invitation link is not valid.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const accept = async () => {
    if (!token || !preview) return;
    if (name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    if (!consent) {
      setError('Confirm that this is your work email and that you will record location only while clocked in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicApi.acceptInvitation({ token, name: name.trim(), password });
      setAccepted(true);
    } catch (cause) {
      setError(messageOf(cause, 'The invitation could not be accepted.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!preview) return;
    try {
      await authClient.sendVerificationEmail({ email: preview.email });
      setResent(true);
    } catch {
      setError('The verification email could not be sent. Try again in a minute.');
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading label="Opening invitation" />
      </Screen>
    );
  }

  if (loadError || !preview) {
    return (
      <Screen>
        <View className="px-5 pt-4">
          <BrandLockup height={22} />
          <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">Invitation</Text>
          <Text className="mt-2 text-[31px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
            This invitation <Text className="text-cobalt">cannot be opened.</Text>
          </Text>
          <Text className="mt-3 text-[13.5px] leading-5 text-muted">
            Invitation links are single-use, expire after seven days, and can be revoked by the site owner.
          </Text>
        </View>
        <View className="px-5 pt-6">
          <Card className="p-5">
            <ErrorNote message={loadError ?? 'This invitation link is not valid.'} />
            <Text className="text-[13px] leading-5 text-muted">
              Ask your site owner to send a fresh invitation, then open the newest link in that email.
            </Text>
            <View className="mt-5">
              <Button label="Go to sign in" variant="secondary" onPress={() => router.replace('/sign-in')} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (preview.status !== 'PENDING') {
    const message =
      preview.status === 'EXPIRED'
        ? 'This invitation has expired. Ask your site owner for a new one.'
        : preview.status === 'ACCEPTED'
          ? 'This invitation has already been used. Sign in with the account you created.'
          : 'This invitation was revoked by the site owner.';
    return (
      <Screen>
        <View className="px-5 pt-4">
          <BrandLockup height={22} />
          <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">Invitation</Text>
          <Text className="mt-2 text-[31px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
            Invitation no longer <Text className="text-cobalt">active.</Text>
          </Text>
        </View>
        <View className="px-5 pt-6">
          <Card className="p-5">
            <Text className="text-[13.5px] leading-5 text-muted">{message}</Text>
            <View className="mt-5">
              <Button label="Go to sign in" onPress={() => router.replace('/sign-in')} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (accepted) {
    return (
      <Screen>
        <View className="px-5 pt-4">
          <BrandLockup height={22} />
          <View className="mt-9 h-12 w-12 items-center justify-center rounded-full bg-cobalt-soft">
            <IconMail size={22} color="#2457D6" />
          </View>
          <Text className="mt-5 text-[31px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
            Check your <Text className="text-cobalt">email.</Text>
          </Text>
          <Text className="mt-3 text-[13.5px] leading-5 text-muted">
            Your account for {preview.siteName ?? preview.organizationName} is created. Open the verification link we
            sent to {preview.email}, then sign in.
          </Text>
        </View>
        <View className="px-5 pt-6">
          <Card className="p-5">
            {resent ? <Notice tone="success">Verification email sent again.</Notice> : null}
            <Text className="text-[13px] leading-5 text-muted">
              Email verification keeps the wrong person from claiming your invitation. The link expires in an hour.
            </Text>
            <View className="mt-5 gap-2">
              <Button label="I have verified — sign in" onPress={() => router.replace('/sign-in')} />
              <Button
                label={resent ? 'Resend again' : 'Resend verification email'}
                variant="secondary"
                onPress={resend}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="px-5 pt-4">
        <BrandLockup height={22} />
        <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">
          {preview.organizationName}
        </Text>
        <Text className="mt-2 text-[31px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
          Join <Text className="text-cobalt">{preview.siteName ?? preview.organizationName}.</Text>
        </Text>
        <Text className="mt-3 text-[13.5px] leading-5 text-muted">
          {preview.siteName
            ? 'This invitation adds you to a site roster.'
            : 'This invitation adds you to the general team. An owner can assign you to a site afterwards.'}{' '}
          It is for {preview.email} and expires {formatDateTime(preview.expiresAt)}.
        </Text>
      </View>

      <View className="px-5 pb-10 pt-6">
        <Card className="p-5">
          {me ? (
            <Notice tone="warn">
              You are signed in as {me.user.email}. Sign out before accepting an invitation for a different person.
            </Notice>
          ) : null}
          {preview.note ? (
            <View className="mb-4 rounded-xl bg-canvas px-3.5 py-3">
              <Text className="text-[12px] font-semibold text-faint">Note from your owner</Text>
              <Text className="mt-1 text-[13px] leading-5 text-ink">{preview.note}</Text>
            </View>
          ) : null}
          {error ? <ErrorNote message={error} /> : null}
          <Field label="Full name">
            <Input value={name} onChangeText={setName} placeholder="Ada Obi" autoCapitalize="words" autoComplete="name" />
          </Field>
          <Field label="Password" hint="At least 12 characters.">
            <PasswordInput value={password} onChangeText={setPassword} placeholder="Choose a password" autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" error={confirm && password !== confirm ? 'The passwords do not match.' : null}>
            <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Repeat the password" autoComplete="new-password" />
          </Field>

          <Pressable onPress={() => setConsent((value) => !value)} className="mb-5 flex-row items-start gap-2.5">
            <View
              className={
                consent
                  ? 'mt-0.5 h-5 w-5 items-center justify-center rounded border border-cobalt bg-cobalt'
                  : 'mt-0.5 h-5 w-5 items-center justify-center rounded border border-line-strong bg-white'
              }
            >
              {consent ? <Text className="text-[12px] font-bold text-white">✓</Text> : null}
            </View>
            <Text className="flex-1 text-[12.5px] leading-5 text-muted">
              This is my work email. I understand Manage records my location only while I am clocked in at a site.
            </Text>
          </Pressable>

          {me ? (
            <View className="gap-2">
              <Button
                label="Sign out and continue"
                variant="secondary"
                onPress={async () => {
                  await signOut();
                }}
              />
              <Button label="Accept invitation" onPress={accept} loading={busy} size="lg" />
            </View>
          ) : (
            <Button label="Accept invitation" onPress={accept} loading={busy} size="lg" />
          )}

          <Pressable
            onPress={() => {
              void Linking.openURL(`${WEB_URL}/invite/${token}`);
            }}
            className="mt-4 items-center"
          >
            <Text className="text-[12.5px] font-semibold text-cobalt">Open this invitation on the web instead</Text>
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}
