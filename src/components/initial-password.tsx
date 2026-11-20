'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Card, Field, Input } from './ui';

export function InitialPassword() {
  const { request, refresh, signOut } = useAuth();
  const [currentPassword, setCurrent] = useState(''); const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <main className="mx-auto max-w-lg p-6"><Card className="p-6"><form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await request('/api/v1/me/initial-password', { method: 'POST', body: { currentPassword, newPassword } }); setCurrent(''); setNew(''); setConfirm(''); await refresh(); }
    catch (cause) { setError(errorMessage(cause, 'Could not change password.')); }
    finally { setBusy(false); }
  }}>
    <h1 className="text-xl font-bold">Choose your password</h1><p>Replace the temporary password from your email before using Manage.</p>
    <Field label="Temporary password"><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrent(event.target.value)} required /></Field>
    <Field label="New password"><Input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNew(event.target.value)} required /></Field>
    <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></Field>
    {error ? <p role="alert">{error}</p> : null}<Button type="submit" disabled={busy}>Save new password</Button>
    <Button type="button" variant="secondary" onClick={() => void signOut()}>Sign out</Button>
  </form></Card></main>;
}
