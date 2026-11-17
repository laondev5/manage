import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, Field, Input, ErrorNote, Notice, Card } from '@/components/ui';
import { BrandLockup } from '@/components/brand';
import { authClient } from '@/lib/session';
import { WEB_URL } from '@/lib/config';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${WEB_URL}/reset-password`,
      });
      setSent(true);
    } catch {
      setError('The reset email could not be requested. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="px-5 pt-4">
        <BrandLockup height={22} />
        <Text className="mt-10 text-[11px] font-bold uppercase tracking-[1.6px] text-cobalt">
          Account recovery
        </Text>
        <Text className="mt-2 text-[33px] font-bold leading-[40px] tracking-[-0.8px] text-ink">
          Reset your <Text className="text-cobalt">password.</Text>
        </Text>
        <Text className="mt-3 text-[13.5px] leading-5 text-muted">
          We send a single-use link to your work email. Resetting your password signs out every device.
        </Text>
      </View>

      <View className="px-5 pt-6">
        <Card className="p-5">
          {sent ? (
            <>
              <Notice tone="success">
                If an account exists for {email.trim()}, a reset link is on its way. It expires in one hour.
              </Notice>
              <Text className="text-[13px] leading-5 text-muted">
                Open the link on the web to choose a new password. Then return here and sign in with it.
              </Text>
              <View className="mt-5">
                <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
              </View>
            </>
          ) : (
            <>
              {error ? <ErrorNote message={error} /> : null}
              <Field label="Work email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onSubmitEditing={submit}
                />
              </Field>
              <Button
                label="Send reset link"
                onPress={submit}
                loading={busy}
                disabled={!email.includes('@')}
                size="lg"
              />
              <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/sign-in')} />
            </>
          )}
        </Card>
      </View>
    </Screen>
  );
}
