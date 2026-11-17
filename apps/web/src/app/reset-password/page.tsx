'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { IconCheck, IconLock } from '@/components/icons';
import { Button, Field, InlineError, Input } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';

const MIN = 12;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN && password === confirm;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (cause) {
      setError(errorMessage(cause, 'That reset link could not be used. Request a new one.'));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="This reset link is incomplete"
        description="Open the most recent reset email and follow the button, or request a fresh link."
        footer={
          <Link href="/forgot-password" className="text-[13px] font-medium text-cobalt hover:underline">
            Request a new reset link
          </Link>
        }
      >
        <AuthCard>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Reset links are single-use and expire after an hour. If you already reset this password, sign in
            with the new one.
          </p>
          <Link href="/sign-in" className="mt-4 block">
            <Button variant="secondary" block>
              Go to sign in
            </Button>
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={done ? 'Password changed' : 'Choose a new password'}
      description={
        done
          ? 'Every other session for this account was signed out. Sign in again with the new password.'
          : 'At least 12 characters. A passphrase of a few unrelated words is easier to remember and harder to guess.'
      }
      footer={
        !done ? (
          <Link href="/sign-in" className="text-[13px] font-medium text-cobalt hover:underline">
            Back to sign in
          </Link>
        ) : undefined
      }
    >
      <AuthCard>
        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8eefc] text-cobalt">
                <IconCheck className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] leading-relaxed text-muted">
                Your password was updated and the reset link is now spent. If two-step verification is on for
                this account, you will need your authenticator code at sign-in.
              </p>
            </div>
            <Button block onClick={() => router.replace('/sign-in')}>
              Sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <IconLock className="h-4 w-4 text-cobalt" />
              This link works once. Changing your password revokes other sessions.
            </div>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field
              label="New password"
              htmlFor="new-password"
              hint={`${password.length}/${MIN} characters minimum`}
              error={password.length > 0 && password.length < MIN ? `Use at least ${MIN} characters.` : null}
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password" error={mismatch ? 'Passwords do not match.' : null}>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                invalid={mismatch}
              />
            </Field>
            <Button type="submit" block loading={busy} disabled={!valid}>
              Save new password
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
