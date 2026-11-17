import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, Field, Input, PasswordInput, ErrorNote, Notice, Card, shadowSoft } from '@/components/ui';
import { IconMail, IconLock, IconShield } from '@/components/icons';
import { BrandLockup } from '@/components/brand';
import { useAuth } from '@/lib/auth';
import { authClient } from '@/lib/session';
import { API_URL } from '@/lib/api';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, verifyTotp } = useAuth();
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  const submitCredentials = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result === 'totp') {
        setStep('totp');
      } else {
        router.replace('/');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Sign-in did not complete. Try again.';
      setError(message);
      setUnverified(/verif/i.test(message));
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(code.replace(/\s+/g, ''));
      router.replace('/');
    } catch {
      setError('That code was not accepted. Check your authenticator app and try the next code.');
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: `${API_URL}/api/v1/health` });
      setResent(true);
    } catch {
      setError('The verification email could not be sent. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <BrandLockup height={22} />
          <View
            className="flex-row items-center gap-1.5 rounded-full bg-white px-3 py-1.5"
            style={shadowSoft}
          >
            <IconShield size={12} color="#2457D6" />
            <Text className="text-[10.5px] font-semibold text-muted">MFA protected</Text>
          </View>
        </View>

        <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">
          Worksite attendance
        </Text>
        <Text className="mt-2 text-[33px] font-bold leading-[40px] tracking-[-0.8px] text-ink">
          {step === 'credentials' ? 'Sign in to ' : 'Confirm it is '}
          <Text className="text-cobalt">{step === 'credentials' ? 'your day.' : 'you.'}</Text>
        </Text>
        <Text className="mt-3 text-[13.5px] leading-5 text-muted">
          {step === 'credentials'
            ? 'Use the account your site owner invited. Owners then confirm a code from their authenticator app.'
            : `Enter the six-digit code for ${email}.`}
        </Text>
      </View>

      <View className="px-5 pt-6">
        <Card className="p-5">
          {step === 'credentials' ? (
            <>
              {error ? <ErrorNote message={error} /> : null}
              {unverified && resent ? (
                <Notice tone="success">Verification email sent. Open the link, then sign in again.</Notice>
              ) : null}
              {unverified && !resent ? (
                <Pressable onPress={resend} className="mb-4">
                  <Text className="text-[13px] font-semibold text-cobalt">Resend the verification email</Text>
                </Pressable>
              ) : null}
              <Field label="Work email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </Field>
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={submitCredentials}
                />
              </Field>
              <Button
                label="Sign in"
                onPress={submitCredentials}
                loading={busy}
                disabled={!email.trim() || !password}
                size="lg"
                icon={<IconLock size={17} color="#fff" />}
              />
              <Pressable onPress={() => router.push('/forgot-password')} className="mt-4 items-center">
                <Text className="text-[13px] font-semibold text-cobalt">Forgot your password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error ? <ErrorNote message={error} /> : null}
              <Field label="Authenticator code" hint="Codes change every 30 seconds.">
                <Input
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  className={undefined}
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                  autoFocus
                  onSubmitEditing={submitTotp}
                />
              </Field>
              <Button
                label="Verify and continue"
                onPress={submitTotp}
                loading={busy}
                disabled={code.length < 6}
                size="lg"
              />
              <Pressable
                onPress={() => {
                  setStep('credentials');
                  setCode('');
                  setError(null);
                }}
                className="mt-4 items-center"
              >
                <Text className="text-[13px] font-semibold text-cobalt">Use a different account</Text>
              </Pressable>
            </>
          )}
        </Card>

        <View className="mt-6 items-center px-4">
          <Text className="text-center text-[12.5px] leading-5 text-muted">
            Invited but no account yet? Open the invitation link from your owner&apos;s email — invitations are
            single-use and expire after seven days.
          </Text>
          <View className="mt-4 flex-row items-center gap-1.5">
            <IconMail size={13} />
            <Text className="text-[11.5px] text-faint">Manage · Corporate worksite attendance</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}
