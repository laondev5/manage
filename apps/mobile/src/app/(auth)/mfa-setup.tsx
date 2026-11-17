import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Screen, Button, Field, Input, PasswordInput, ErrorNote, Notice, Card } from '@/components/ui';
import { IconShield } from '@/components/icons';
import { BrandLockup } from '@/components/brand';
import { useAuth } from '@/lib/auth';
import { authClient } from '@/lib/session';

type Enrollment = { totpURI: string; backupCodes: string[] };

export default function MfaSetupScreen() {
  const router = useRouter();
  const { me, refresh, signOut } = useAuth();
  const [step, setStep] = useState<'password' | 'scan' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secret = enrollment?.totpURI.match(/[?&]secret=([^&]+)/)?.[1] ?? '';

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error || !result.data) throw new Error('Enrollment could not start.');
      if (result.data.method !== 'totp') {
        throw new Error('This account already uses a different second factor.');
      }
      setEnrollment({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
      setStep('scan');
    } catch {
      setError('That password was not accepted. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\D/g, '') });
      if (result.error) throw new Error('That code was not accepted.');
      await refresh();
      router.replace('/');
    } catch {
      setError('That code was not accepted. Check your authenticator app and try the next code.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <BrandLockup height={22} />
          <View className="h-10 w-10 items-center justify-center rounded-full bg-cobalt-soft">
            <IconShield size={18} color="#2457D6" />
          </View>
        </View>
        <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">Security</Text>
        <Text className="mt-2 text-[31px] font-bold leading-[38px] tracking-[-0.7px] text-ink">
          Protect your workspace with <Text className="text-cobalt">two-step verification.</Text>
        </Text>
        <Text className="mt-3 text-[13.5px] leading-5 text-muted">
          Owner and platform admin accounts must enroll an authenticator app before opening Manage.
        </Text>
      </View>

      <View className="px-5 pb-8 pt-6">
        <Card className="p-5">
          {error ? <ErrorNote message={error} /> : null}

          {step === 'password' ? (
            <>
              <Notice tone="warn">
                We ask for your password again so a borrowed phone cannot enroll its own authenticator.
              </Notice>
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  autoComplete="current-password"
                  onSubmitEditing={begin}
                />
              </Field>
              <Button label="Continue" onPress={begin} loading={busy} disabled={!password} size="lg" />
            </>
          ) : null}

          {step === 'scan' && enrollment ? (
            <>
              <Text className="text-[13.5px] leading-5 text-muted">
                Scan this code with Google Authenticator, 1Password, Authy, or any TOTP app. Then keep the backup
                codes somewhere offline.
              </Text>
              <View className="my-5 items-center rounded-2xl border border-line bg-white p-4">
                <QRCode value={enrollment.totpURI} size={190} color="#101D35" backgroundColor="#FFFFFF" />
              </View>
              <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-faint">
                Can&apos;t scan? Enter this key manually
              </Text>
              <Text selectable className="mt-1.5 rounded-lg bg-canvas p-3 font-mono text-[12px] leading-5 text-ink">
                {secret}
              </Text>
              <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[1.1px] text-faint">
                Backup codes — shown once
              </Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
                {enrollment.backupCodes.map((backup) => (
                  <Text key={backup} selectable className="font-mono text-[12.5px] text-ink">
                    {backup}
                  </Text>
                ))}
              </View>
              <View className="mt-6">
                <Button label="I have scanned the code" onPress={() => setStep('confirm')} size="lg" />
              </View>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <Field label="Authenticator code" hint="Six digits from the app you just enrolled.">
                <Input
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                  autoFocus
                  onSubmitEditing={confirm}
                />
              </Field>
              <Button
                label="Finish setup"
                onPress={confirm}
                loading={busy}
                disabled={code.length < 6}
                size="lg"
              />
              <Button
                label="Back to the code"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setStep('scan');
                  setCode('');
                  setError(null);
                }}
              />
            </>
          ) : null}
        </Card>

        <View className="mt-5">
          <Button
            label="Finish later — the workspace stays locked"
            variant="ghost"
            onPress={async () => {
              await signOut();
              router.replace('/sign-in');
            }}
          />
          {me ? <Text className="mt-2 text-center text-[11.5px] text-faint">Signed in as {me.user.email}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
