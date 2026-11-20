'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/use-api-data';
import { errorMessage } from '@/lib/api';
import type { OrganizationSummary, Role, SiteSummary } from '@/contracts';
import { Button, Card, Field, Input, Select } from './ui';

export function CreateAccount({ admin = false, onCreated }: { admin?: boolean; onCreated?: () => void }) {
  const { me, request } = useAuth();
  const organizations = useApiData<OrganizationSummary[]>(admin ? '/api/v1/admin/organizations' : null);
  const sites = useApiData<SiteSummary[]>('/api/v1/sites');
  const [organizationId, setOrganizationId] = useState(me?.activeOrganizationId ?? '');
  const [role, setRole] = useState<Role>('STAFF');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<string[]>([]); const [permitted, setPermitted] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <Card className="my-4 p-5"><form className="grid gap-4 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await request<{ emailProvider: string }>('/api/v1/accounts', { method: 'POST', body: { organizationId, name, email, phone, role, siteIds: selected, canUpdateSiteLocation: permitted } });
      setMessage(result.emailProvider === 'local' ? 'Account created. Development email adapter: verification and temporary-password messages were saved locally, not emailed.' : 'Account created. Email verification is required before sign-in. Their temporary password is emailed to them and must be replaced on first sign-in.'); onCreated?.();
    } catch (cause) { setMessage(errorMessage(cause, 'Could not create account.')); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-bold md:col-span-2">Create account</h2>
    <Field label="Organization"><Select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setSelected([]); }} required>
      <option value="">Choose organization</option>
      {admin ? organizations.data?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>) : me?.memberships.filter((m) => m.role === 'SITE_OWNER').map((m) => <option key={m.organizationId} value={m.organizationId}>{m.organizationName}</option>)}
    </Select></Field>
    <Field label="Role"><Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
      <option value="STAFF">Staff</option><option value="SUPERVISOR">Supervisor</option>
      {admin ? <><option value="SITE_OWNER">Owner</option><option value="PLATFORM_ADMIN">Administrator</option></> : null}
    </Select></Field>
    <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
    <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
    <Field label="Phone"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
    {role === 'SUPERVISOR' ? <label><input type="checkbox" checked={permitted} onChange={(event) => setPermitted(event.target.checked)} /> Allow assigned-site coordinate updates</label> : null}
    <fieldset className="md:col-span-2"><legend>Site assignments</legend>{sites.data?.filter((site) => site.organizationId === organizationId).map((site) => <label key={site.id} className="mr-4 inline-flex gap-2"><input type="checkbox" checked={selected.includes(site.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, site.id] : selected.filter((id) => id !== site.id))} />{site.name}</label>)}</fieldset>
    <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
    <p role="status" className="md:col-span-2">{message}</p>
  </form></Card>;
}
