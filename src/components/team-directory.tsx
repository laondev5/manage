'use client';
import { useState } from 'react';
import type { SiteSummary, TeamMemberDetail, TeamMemberSummary } from '@/contracts';
import { useApiData } from '@/lib/use-api-data';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { ActivityHistory } from './activity-history';
import { Button, Card, Field, Input, Select } from './ui';

export function TeamDirectory() {
  const members = useApiData<TeamMemberSummary[]>('/api/v1/team');
  const [selected, setSelected] = useState('');
  return <section className="space-y-4"><h2 className="font-bold">Staff</h2>
    {members.error ? <p role="alert">{errorMessage(members.error, 'Could not load staff.')}</p> : null}
    <div className="flex flex-wrap gap-2">{members.data?.map((member) => <Button variant="secondary" key={member.memberId} onClick={() => setSelected(member.memberId)}>{member.name} · {member.role === 'SUPERVISOR' ? 'Supervisor' : 'Staff'}</Button>)}</div>
    {selected ? <MemberEditor key={selected} id={selected} onRemoved={() => { setSelected(''); members.reload(); }} /> : <p>Select a staff member to manage their account and view attendance.</p>}
  </section>;
}

function MemberEditor({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const member = useApiData<TeamMemberDetail>(`/api/v1/team/${encodeURIComponent(id)}`);
  if (!member.data) return <p>{member.error ? errorMessage(member.error, 'Could not load staff.') : 'Loading staff…'}</p>;
  return <><MemberForm key={member.data.member.membershipVersion} detail={member.data} onSaved={member.reload} onRemoved={onRemoved} /><ActivityHistory memberId={id} /></>;
}

function MemberForm({ detail, onSaved, onRemoved }: { detail: TeamMemberDetail; onSaved: () => void; onRemoved: () => void }) {
  const { request } = useAuth(); const member = detail.member;
  const sites = useApiData<SiteSummary[]>('/api/v1/sites');
  const [email, setEmail] = useState(member.email);
  const [name, setName] = useState(member.name); const [phone, setPhone] = useState(member.phone ?? '');
  const [role, setRole] = useState(member.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'STAFF');
  const [permitted, setPermitted] = useState(member.canUpdateSiteLocation ?? false);
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); try { await action(); onSaved(); } catch (cause) { setError(errorMessage(cause, 'Could not save changes.')); } finally { setBusy(false); } };
  return <Card className="space-y-4 p-5"><h3 className="font-bold">{member.name}</h3><p>{member.email} · {member.status}</p>
    <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
    <Field label="Phone"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
    <Field label="Role"><Select value={role} onChange={(event) => setRole(event.target.value)}><option value="STAFF">Staff</option><option value="SUPERVISOR">Supervisor</option></Select></Field>
    {role === 'SUPERVISOR' ? <label className="block"><input type="checkbox" checked={permitted} onChange={(event) => setPermitted(event.target.checked)} /> Allow coordinate updates on assigned sites</label> : null}
    <Button disabled={busy} onClick={() => void run(() => request(`/api/v1/team/${idOf(member)}/profile`, { method: 'PATCH', body: { name, phone, ...(email !== member.email ? { email } : {}), role, canUpdateSiteLocation: permitted, expectedVersion: member.membershipVersion } }))}>Save staff</Button>
    <fieldset className="space-y-2"><legend>Site assignments</legend>{sites.data?.map((site) => {
      const assignment = detail.sites.find((entry) => entry.id === site.id);
      const assigned = Boolean(assignment);
      return <label key={site.id} className="block"><input type="checkbox" disabled={busy} checked={assigned} onChange={() => void run(() => request(`/api/v1/sites/${site.id}/assignments${assigned ? `/${assignment!.assignmentId}` : ''}`, { method: assigned ? 'DELETE' : 'POST', body: assigned ? { reason: 'Removed by site owner' } : { memberId: member.id } }))} /> {site.name}</label>;
    })}</fieldset>
    <Field label="Reason for suspension or removal"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy || reason.trim().length < 5} onClick={() => void run(() => request(`/api/v1/team/${idOf(member)}/status`, { method: 'PATCH', body: { status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE', reason, expectedVersion: member.membershipVersion } }))}>{member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Button>
    <Button variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => { if (window.confirm('Remove this staff member? Attendance history will be retained.')) void run(async () => { await request(`/api/v1/team/${idOf(member)}`, { method: 'DELETE', body: { reason, expectedVersion: member.membershipVersion } }); onRemoved(); }); }}>Remove staff</Button></div>
    {error ? <p role="alert">{error}</p> : null}
  </Card>;
}
const idOf = (member: TeamMemberDetail['member']) => encodeURIComponent(member.id);
