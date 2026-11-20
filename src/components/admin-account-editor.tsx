'use client';
import { useState } from 'react';
import type { AdminUserSummary, Role } from '@/contracts';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { ActivityHistory } from './activity-history';
import { Button, Card, Field, Input, Select } from './ui';

export function AdminAccountEditor({ user, onSaved }: { user: AdminUserSummary; onSaved: () => void }) {
  const { request } = useAuth();
  const [name, setName] = useState(user.name); const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? ''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await action(); setMessage('Saved. Changed email addresses must be verified again.'); onSaved(); } catch (cause) { setMessage(errorMessage(cause, 'Could not save account.')); } finally { setBusy(false); } };
  return <Card className="space-y-4 p-5"><h2 className="font-bold">Edit {user.name}</h2>
    <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
    <Field label="Phone"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
    <Button disabled={busy} onClick={() => void run(() => request(`/api/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { name, email, phone } }))}>Save account</Button>
    {user.memberships.map((membership) => <Field key={membership.organizationId} label={`Role in ${membership.organizationName}`}><Select disabled={busy || !membership.id} value={membership.role} onChange={(event) => { const role = event.target.value as Role; if (window.confirm(`Change this account's role to ${role}?`)) void run(() => request(`/api/v1/admin/memberships/${membership.id}`, { method: 'PATCH', body: { role, reason: 'Role updated by administrator' } })); }}>
      <option value="STAFF">Staff</option><option value="SUPERVISOR">Supervisor</option><option value="SITE_OWNER">Owner</option><option value="PLATFORM_ADMIN">Administrator</option>
    </Select></Field>)}
    <p role="status">{message}</p><ActivityHistory memberId={user.id} />
  </Card>;
}
