'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { IconBuilding, IconCheck, IconMail, IconPin } from '@/components/icons';
import {
  Button,
  Field,
  InlineError,
  InlineNotice,
  Input,
  PageLoading,
  Stepper,
} from '@/components/ui';
import { authApi, errorMessage, publicApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type InvitationPreview = {
  email: string;
  siteName: string | null;
  organizationName: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  note: string | null;
};

const MIN = 12;

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [resent, setResent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await publicApi<InvitationPreview>(`/api/v1/invitations/${token}`);
      setPreview(result);
    } catch (cause) {
      setLoadError(errorMessage(cause, 'This invitation link could not be checked.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const mismatch = confirm.length > 0 && confirm !== password;
  const valid =
    name.trim().length >= 2 && password.length >= MIN && password === confirm && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await publicApi('/api/v1/invitations/accept', {
        method: 'POST',
        body: { token, name: name.trim(), password },
      });
      setAccepted(true);
    } catch (cause) {
      setError(errorMessage(cause, 'This invitation could not be accepted. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoading label="Checking your invitation" />
      </div>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthLayout
        title="This invitation cannot be opened"
        description="Invitation links are single-use, expire after seven days, and can be revoked by the site owner."
        footer={
          <Link href="/sign-in" className="text-[13px] font-medium text-cobalt hover:underline">
            Already have an account? Sign in
          </Link>
        }
      >
        <AuthCard>
          <InlineError>{loadError ?? 'This invitation link is not valid.'}</InlineError>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Ask your site owner to send a fresh invitation, then open the newest link in that email.
          </p>
          <Button variant="secondary" block className="mt-4" onClick={() => void load()}>
            Check the link again
          </Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (preview.status !== 'PENDING') {
    const copy =
      preview.status === 'ACCEPTED'
        ? 'This invitation was already used. Sign in with the account you created.'
        : preview.status === 'EXPIRED'
          ? 'This invitation expired. Ask your site owner for a new one.'
          : 'This invitation was revoked. Ask your site owner for a new one.';
    return (
      <AuthLayout title="This invitation is no longer active" description={copy}>
        <AuthCard>
          <Link href="/sign-in" className="block">
            <Button block>Sign in</Button>
          </Link>
          <Link href="/forgot-password" className="mt-3 block text-center text-[13px] font-medium text-cobalt hover:underline">
            Forgot your password?
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (accepted) {
    return (
      <AuthLayout
        title="Check your email to finish"
        description="Your account exists, but Manage only opens after the address is confirmed."
        footer={
          <Link href="/sign-in" className="text-[13px] font-medium text-cobalt hover:underline">
            Go to sign in
          </Link>
        }
      >
        <AuthCard>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8eefc] text-cobalt">
              <IconMail className="h-4.5 w-4.5" />
            </span>
            <div className="text-[13.5px] leading-relaxed text-muted">
              We sent a verification link to <span className="font-medium text-ink">{preview.email}</span>.
              Open it, then sign in to {preview.organizationName}. The link expires in one hour.
            </div>
          </div>
          {resent ? (
            <div className="mt-4">
              <InlineNotice tone="success">Verification email re-sent. Check the inbox and spam folder.</InlineNotice>
            </div>
          ) : null}
          <Button
            variant="secondary"
            block
            className="mt-4"
            onClick={async () => {
              try {
                await authApi.resendVerification(
                  preview.email,
                  `${window.location.origin}/sign-in`,
                );
                setResent(true);
              } catch {
                setError('We could not resend that email just now. Try again in a minute.');
              }
            }}
          >
            Resend verification email
          </Button>
          {error ? (
            <div className="mt-3">
              <InlineError>{error}</InlineError>
            </div>
          ) : null}
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      wide
      title="Join your team on Manage"
      description={`${preview.organizationName} invited ${preview.email}. Create your account, confirm the email, then clock in from the mobile app.`}
      footer={
        <Link href="/sign-in" className="text-[13px] font-medium text-cobalt hover:underline">
          Already have an account? Sign in instead
        </Link>
      }
    >
      <div className="mb-4">
        <Stepper steps={['Review invitation', 'Create account', 'Confirm email']} current={1} />
      </div>
      <AuthCard>
        <div className="mb-5 space-y-2 rounded-xl border border-line bg-canvas p-3">
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <IconBuilding className="h-4 w-4 text-muted" />
            <span className="font-medium">{preview.organizationName}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <IconPin className="h-4 w-4 text-muted" />
            <span>{preview.siteName ?? 'General team'}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <IconMail className="h-4 w-4 text-muted" />
            <span>{preview.email}</span>
          </div>
          <p className="pt-1 text-[11.5px] text-muted">Invitation expires {formatDateTime(preview.expiresAt)}</p>
          {preview.note ? (
            <p className="border-t border-line pt-2 text-[12.5px] leading-relaxed text-muted">
              “{preview.note}”
            </p>
          ) : null}
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <InlineError>{error}</InlineError> : null}
          <Field label="Full name" htmlFor="invite-name">
            <Input
              id="invite-name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="As it should appear on reports"
            />
          </Field>
          <Field
            label="Password"
            htmlFor="invite-password"
            hint={`${password.length}/${MIN} characters minimum`}
            error={password.length > 0 && password.length < MIN ? `Use at least ${MIN} characters.` : null}
          >
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm password" htmlFor="invite-confirm" error={mismatch ? 'Passwords do not match.' : null}>
            <Input
              id="invite-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              invalid={mismatch}
            />
          </Field>
          <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-line text-cobalt focus:ring-cobalt"
            />
            I understand my location is checked while I clock in or out, and my shift records are kept for
            payroll review.
          </label>
          <Button type="submit" block loading={busy} disabled={!valid} icon={<IconCheck className="h-4 w-4" />}>
            Create my account
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
