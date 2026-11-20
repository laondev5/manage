'use client';
import { useState } from 'react';
import type { ActivityPage } from '@/contracts';
import { useApiData } from '@/lib/use-api-data';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { Button, Card } from './ui';

export function ActivityHistory({ siteId, memberId }: { siteId?: string; memberId?: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const query = new URLSearchParams({ ...(siteId ? { siteId } : {}), ...(memberId ? { memberId } : {}), ...(cursor ? { cursor } : {}) });
  const resource = useApiData<ActivityPage>(`/api/v1/activity?${query}`);
  return <section className="my-5 space-y-3"><h2 className="font-bold">Attendance & departures</h2>
    {resource.loading ? <p>Loading attendance…</p> : null}
    {resource.error ? <p role="alert">{errorMessage(resource.error, 'Could not load attendance.')}</p> : null}
    {resource.data?.items.map((row) => <Card key={row.id} className="space-y-2 p-4">
      <p className="font-semibold">{row.memberName} · {row.siteName}</p>
      <p>Clock-in: {formatDateTime(row.startedAt)}</p>
      <p>Clock-out: {row.endedAt ? formatDateTime(row.endedAt) : 'Still clocked in'}</p>
      {row.departures.map((departure, index) => <p key={index}>Left site: {formatDateTime(departure.detectedAt)} · {departure.returnedAt ? `Returned: ${formatDateTime(departure.returnedAt)}` : 'No return recorded'}</p>)}
    </Card>)}
    {resource.data?.items.length === 0 ? <p>No attendance recorded.</p> : null}
    {resource.data?.nextCursor ? <Button onClick={() => setCursor(resource.data!.nextCursor)}>Older attendance</Button> : null}
    {cursor ? <Button variant="secondary" onClick={() => setCursor(null)}>Newest attendance</Button> : null}
  </section>;
}
