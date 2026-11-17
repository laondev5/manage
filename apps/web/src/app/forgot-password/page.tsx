'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { IconMail } from '@/components/icons';
import { Button, Field, InlineError, Input } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(email.trim(), `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (cause) {
      setError(errorMessage(cause, 'We could not start a reset just now. Try again in a minute.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      description="We will email a single-use link to the address on your Manage account. The link expires in one hour."
      footer={
        <Link href="/sign-in" className="text-[13px] font-medium text-cobalt hover:underline">
          Back to sign in
        </Link>
      }
    >
      <AuthCard>
        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8eefc] text-cobalt">
                <IconMail className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-[14px] font-medium text-ink">Check your inbox</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  If an account exists for <span className="font-medium text-ink">{email.trim()}</span>, a reset
                  link is on its way. Nobody is told whether the address is registered.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
            >
              Use a different address
            </Button>
            <Link href="/sign-in" className="block text-center text-[13px] font-medium text-cobalt hover:underline">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error ? <InlineError>{error}</InlineError> : null}
            <Field label="Work email" htmlFor="reset-email">
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Button type="submit" block loading={busy} disabled={!email}>
              Send reset link
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
