'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { IconCheck, IconLock, IconShield } from '@/components/icons';
import {
  Button,
  CopyButton,
  Field,
  InlineError,
  InlineNotice,
  Input,
  PageLoading,
  Stepper,
} from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STEPS = ['Confirm password', 'Scan the code', 'Verify a code'];

export default function MfaSetupPage() {
  const router = useRouter();
  const { me, loading, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me) router.replace('/sign-in?next=/mfa-setup');
  }, [loading, me, router]);

  if (loading) return <PageLoading label="Loading your account" />;
  if (!me) return null;

  if (me.user.twoFactorEnabled) {
    return (
      <AuthLayout
        title="Two-step verification is already on"
        description={`Everything is set for ${me.user.email}. Continue to the workspace.`}
      >
        <AuthCard>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8eefc] text-cobalt">
              <IconCheck className="h-5 w-5" />
            </span>
            <div className="text-[13.5px] leading-relaxed text-muted">
              Codes from your authenticator app are required at every sign-in. Keep the backup codes you
              saved earlier somewhere safe.
            </div>
          </div>
          <Button className="mt-5" block onClick={() => router.replace('/')}>
            Go to the workspace
          </Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  const startSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.enableTwoFactor(password);
      const parsed = new URL(result.totpURI);
      setSecret(parsed.searchParams.get('secret'));
      setOtpauth(result.totpURI);
      setBackupCodes(result.backupCodes ?? []);
      setStep(1);
    } catch (cause) {
      setError(errorMessage(cause, 'We could not start two-step setup. Check your password.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyTwoFactorSetup(code.replace(/\s+/g, ''));
      await refresh();
      router.replace('/');
    } catch {
      setError('That code was not accepted. Check the app clock and try the next code.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      wide
      title="Protect your workspace with two-step verification"
      description="Owner and platform admin accounts must enroll an authenticator app before opening Manage on the web."
      footer={
        <button
          type="button"
          className="text-[13px] font-medium text-muted hover:text-ink"
          onClick={() => router.replace('/')}
        >
          Finish later — the workspace stays locked until this is done
        </button>
      }
    >
      <div className="mb-4">
        <Stepper steps={STEPS} current={step} />
      </div>
      <AuthCard>
        {step === 0 ? (
          <form onSubmit={startSetup} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <IconLock className="h-4 w-4 text-cobalt" />
              Re-enter your password to begin enrollment.
            </div>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Password" htmlFor="mfa-password">
              <Input
                id="mfa-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button type="submit" block loading={busy} disabled={!password}>
              Continue
            </Button>
          </form>
        ) : null}

        {step === 1 && otpauth ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted">
              Scan this code with Google Authenticator, 1Password, Authy, or any TOTP app. Then keep the
              backup codes below somewhere offline.
            </p>
            <div className="flex justify-center rounded-xl border border-line bg-white p-4">
              <QRCode value={otpauth} size={168} fgColor="#101d35" bgColor="#ffffff" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-ink">Cannot scan? Enter this key manually</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all overflow-x-auto rounded-lg bg-canvas px-3 py-2 font-mono text-[12.5px] tracking-wide text-ink">
                  {secret ?? '—'}
                </code>
                {secret ? <CopyButton value={secret} /> : null}
              </div>
            </div>
            {backupCodes.length ? (
              <div className="rounded-xl border border-[#f6ddb8] bg-warn-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-warn">
                    Backup codes — shown once
                  </p>
                  <CopyButton value={backupCodes.join('\n')} label="Copy all" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[12.5px] text-ink sm:grid-cols-3">
                  {backupCodes.map((backupCode) => (
                    <span key={backupCode} className="rounded bg-white/70 px-2 py-1">
                      {backupCode}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <Button block onClick={() => setStep(2)}>
              I have scanned the code
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <IconShield className="h-4 w-4 text-cobalt" />
              Enter the current six-digit code from your authenticator app.
            </div>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Verification code" htmlFor="mfa-code">
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="h-12 text-center text-[20px] tracking-[0.4em] tabular"
              />
            </Field>
            <Button type="submit" block loading={busy} disabled={code.length !== 6}>
              Verify and turn on
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              block
              onClick={() => {
                setError(null);
                setCode('');
                setStep(1);
              }}
            >
              Back to the QR code
            </Button>
            <InlineNotice>
              Setup is not complete until a code verifies. Until then, sign-in stays password-only and the
              workspace stays locked for this account.
            </InlineNotice>
          </form>
        ) : null}
      </AuthCard>
    </AuthLayout>
  );
}
