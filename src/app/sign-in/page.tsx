'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { IconLock } from '@/components/icons';
import { Button, Field, InlineError, InlineNotice, Input } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const { refresh } = useAuth();

  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  const finish = async () => {
    const me = await refresh();
    if (me?.mustChangePassword) { router.replace('/'); return; }
    if (me?.mfaSetupRequired) {
      router.replace('/mfa-setup');
      return;
    }
    router.replace(next.startsWith('/') ? next : '/');
  };

  const onCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      const result = await authApi.signIn(email.trim(), password);
      if (result.twoFactorRedirect) {
        setStep('totp');
        setBusy(false);
        return;
      }
      await finish();
    } catch (cause) {
      const message = errorMessage(cause, 'Sign-in did not complete. Try again.');
      setError(message);
      setUnverified(/verif/i.test(message));
      setBusy(false);
    }
  };

  const onTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyTotp(code.replace(/\s+/g, ''));
      await finish();
    } catch {
      setError('That code was not accepted. Check your authenticator and try the next code.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={step === 'credentials' ? 'Sign in to Manage' : 'Enter your authenticator code'}
      description={
        step === 'credentials'
          ? 'Use the account your site owner invited. Platform admins and owners then confirm a code from their authenticator app.'
          : `A six-digit code from the authenticator app enrolled for ${email}.`
      }
      footer={
        step === 'credentials' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <Link href="/forgot-password" className="font-medium text-cobalt hover:underline">
              Forgot your password?
            </Link>
            <span className="text-muted">
              Invited but no account?{' '}
              <span className="text-ink">Open the invitation link in your email.</span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="text-[13px] font-medium text-cobalt hover:underline"
            onClick={() => {
              setStep('credentials');
              setCode('');
              setError(null);
            }}
          >
            Use a different account
          </button>
        )
      }
    >
      <AuthCard>
        {step === 'credentials' ? (
          <form onSubmit={onCredentials} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            {unverified && resent ? (
              <InlineNotice tone="success">
                Verification email sent. Open the link in that email, then sign in again.
              </InlineNotice>
            ) : null}
            <Field label="Work email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
              />
            </Field>
            <Button type="submit" block loading={busy} disabled={!email || !password}>
              Sign in
            </Button>
            {unverified ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                block
                onClick={async () => {
                  try {
                    await authApi.resendVerification(
                      email.trim(),
                      `${window.location.origin}/sign-in`,
                    );
                    setResent(true);
                  } catch {
                    setError('We could not resend the verification email just now.');
                  }
                }}
              >
                Resend verification email
              </Button>
            ) : null}
          </form>
        ) : (
          <form onSubmit={onTotp} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <div className="flex items-center gap-2 rounded-[10px] bg-canvas px-3 py-2.5 text-[12.5px] text-muted">
              <IconLock className="h-4 w-4 shrink-0 text-cobalt" />
              Codes rotate every 30 seconds. If this one fails, wait for the next.
            </div>
            <Field label="Six-digit code" htmlFor="code">
              <Input
                id="code"
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
              Verify and continue
            </Button>
            <p className="text-center text-[12px] leading-relaxed text-muted">
              Lost your authenticator? Ask a platform admin to reset your two-step verification.
            </p>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
