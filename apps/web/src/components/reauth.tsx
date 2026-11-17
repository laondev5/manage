'use client';

import { useState } from 'react';
import { authApi, errorMessage, resetCsrfCache } from '@/lib/api';
import { Button, Field, InlineError, Input, Modal } from './ui';
import { IconLock, IconShield } from './icons';

/**
 * The API requires a session created within the last 15 minutes for sensitive
 * admin actions. This dialog re-establishes the session (password + TOTP when
 * enrolled) without leaving the page, then retries the action.
 */
export function ReauthDialog({
  open,
  email,
  onClose,
  onDone,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setPassword('');
    setCode('');
    setStep('password');
    setError(null);
    onClose();
  };

  const signIn = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.signOut();
      resetCsrfCache();
      const result = await authApi.signIn(email, password);
      if (result.twoFactorRedirect) {
        setStep('totp');
        setBusy(false);
        return;
      }
      resetCsrfCache();
      setBusy(false);
      onDone();
      close();
    } catch (cause) {
      setError(errorMessage(cause, 'We could not confirm your session.'));
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyTotp(code.replace(/\s+/g, ''));
      resetCsrfCache();
      setBusy(false);
      onDone();
      close();
    } catch {
      setError('That code was not accepted. Try the next code from your authenticator.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Confirm it is you"
      description="Sensitive admin changes require a sign-in from the last 15 minutes. Confirm here and the action will run."
      footer={
        step === 'password' ? (
          <>
            <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form="reauth-form" loading={busy} disabled={!password}>
              Confirm
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
        )
      }
    >
      {step === 'password' ? (
        <form id="reauth-form" onSubmit={signIn} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 text-[12.5px] text-muted">
            <IconLock className="h-4 w-4 shrink-0 text-cobalt" />
            Signed in as {email}. Re-enter your password to start a fresh session.
          </div>
          <Field label="Password" htmlFor="reauth-password">
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 text-[12.5px] text-muted">
            <IconShield className="h-4 w-4 shrink-0 text-cobalt" />
            Enter the current code from your authenticator app.
          </div>
          <Field label="Six-digit code" htmlFor="reauth-code">
            <Input
              id="reauth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="h-12 text-center text-[19px] tracking-[0.4em] tabular"
            />
          </Field>
          <Button type="submit" block loading={busy} disabled={code.length !== 6}>
            Verify
          </Button>
        </form>
      )}
    </Modal>
  );
}

/** Returns true when the API rejected the request because the session is too old. */
export function isRecentAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'FORBIDDEN' &&
    /sign in again/i.test(error.message)
  );
}
