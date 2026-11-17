'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconBuilding, IconCheck, IconLock, IconLogout, IconShield } from '@/components/icons';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  PageHeader,
  SectionLabel,
} from '@/components/ui';
import { roleLabel } from '@/lib/format';
import { useAuth } from '@/lib/auth';

export default function AccountPage() {
  const { me, signOut, switchOrganization } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const capabilities = [...new Set(me.capabilities)].sort();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Account"
        description="Your identity, organization memberships, and sign-in protection."
      />

      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-4 p-5">
            <Avatar name={me.user.name} className="h-14 w-14 text-[17px]" />
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-semibold text-ink">{me.user.name}</p>
              <p className="text-[13px] text-muted">{me.user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {me.user.emailVerified ? (
                <Badge tone="blue" dot>
                  Email verified
                </Badge>
              ) : (
                <Badge tone="amber">Email unconfirmed</Badge>
              )}
              {me.user.twoFactorEnabled ? (
                <Badge tone="blue" dot>
                  MFA on
                </Badge>
              ) : (
                <Badge tone="amber">MFA off</Badge>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Organizations" description="Switch between the workspaces you belong to." />
          <ul className="divide-y divide-line">
            {me.memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-muted">
                  <IconBuilding className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {membership.organizationName}
                    {membership.organizationId === me.activeOrganizationId ? (
                      <span className="ml-2 text-[11.5px] font-normal text-cobalt">Active</span>
                    ) : null}
                  </p>
                  <p className="text-[12px] text-muted">
                    {roleLabel(membership.role)} · {membership.status.toLowerCase()}
                  </p>
                </div>
                {membership.organizationId === me.activeOrganizationId ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-cobalt">
                    <IconCheck className="h-3.5 w-3.5" /> Selected
                  </span>
                ) : membership.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await switchOrganization(membership.organizationId);
                        router.refresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    Switch
                  </Button>
                ) : (
                  <Badge tone="amber">{membership.status.toLowerCase()}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Sign-in protection" />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-cobalt">
                  <IconShield className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[13.5px] font-medium text-ink">Two-step verification</p>
                  <p className="text-[12.5px] text-muted">
                    {me.user.twoFactorEnabled
                      ? 'On. A code from your authenticator app is required at sign-in.'
                      : 'Off. Owners and admins must turn this on before opening the workspace.'}
                  </p>
                </div>
              </div>
              {me.user.twoFactorEnabled ? (
                <Badge tone="blue">Enabled</Badge>
              ) : (
                <ButtonLink href="/mfa-setup" size="sm" variant="primary">
                  Set up
                </ButtonLink>
              )}
            </div>
            <div className="flex items-start gap-2.5 border-t border-line pt-3.5">
              <span className="mt-0.5 text-muted">
                <IconLock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-medium text-ink">Sessions</p>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Signing out clears this browser. Sensitive admin actions ask you to sign in again within the
                  last 15 minutes; the API enforces that with the session timestamp, not a client hint.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Capabilities" description="What this account can do right now, as computed by the server." />
          <div className="p-5">
            <SectionLabel>Granted</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {capabilities.length ? (
                capabilities.map((capability) => (
                  <code
                    key={capability}
                    className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11.5px] text-ink"
                  >
                    {capability}
                  </code>
                ))
              ) : (
                <p className="text-[12.5px] text-muted">No capabilities. Ask an owner or admin to review your access.</p>
              )}
            </div>
            {me.assignedSiteIds.length ? (
              <p className="mt-3 text-[12px] text-muted">
                Assigned to {me.assignedSiteIds.length} site{me.assignedSiteIds.length === 1 ? '' : 's'} for
                clock-in.
              </p>
            ) : null}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              router.replace('/sign-in');
            }}
            icon={<IconLogout className="h-4 w-4" />}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
