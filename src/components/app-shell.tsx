'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { Capability } from '../contracts/index';
import { hasCapability, isAdmin, useAuth } from '@/lib/auth';
import {
  IconActivity,
  IconBell,
  IconBuilding,
  IconChevronDown,
  IconClock,
  IconLogout,
  IconMenu,
  IconOverview,
  IconScroll,
  IconShield,
  IconUsers,
  IconX,
} from './icons';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  DeniedState,
  ErrorState,
  InlineNotice,
  PageLoading,
  Spinner,
  cn,
} from './ui';

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
  capability?: Capability;
  adminOnly?: boolean;
  exact?: boolean;
};

const OWNER_NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: IconOverview, capability: 'owner.overview', exact: true },
  { href: '/sites', label: 'Sites', icon: IconBuilding, capability: 'owner.sites' },
  { href: '/alerts', label: 'Alerts', icon: IconBell, capability: 'owner.alerts' },
  { href: '/team', label: 'Team', icon: IconUsers, capability: 'owner.team' },
  { href: '/timesheets', label: 'Timesheets', icon: IconClock, capability: 'owner.exports' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Platform overview', icon: IconOverview, adminOnly: true, exact: true },
  { href: '/admin/organizations', label: 'Organizations', icon: IconBuilding, capability: 'admin.organizations' },
  { href: '/admin/users', label: 'Users & access', icon: IconShield, capability: 'admin.users' },
  { href: '/admin/sites', label: 'All sites', icon: IconActivity, capability: 'admin.sites' },
  { href: '/admin/audit', label: 'Audit log', icon: IconScroll, capability: 'admin.audit' },
  { href: '/admin/health', label: 'System health', icon: IconActivity, capability: 'admin.health' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, loading, error, refresh, signOut, switchOrganization } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    setOrgOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !me && !error) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, me, error, router, pathname]);

  if (loading) return <PageLoading label="Checking your session" />;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState message={error} onRetry={() => void refresh()} />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Spinner className="h-5 w-5 text-cobalt" /> Taking you to sign in…
        </div>
      </div>
    );
  }
  if (me.mfaSetupRequired) return <MfaSetupInterstitial />;

  const admin = isAdmin(me);
  const ownerItems = OWNER_NAV.filter((item) => hasCapability(me, item.capability!));
  const adminItems = ADMIN_NAV.filter(
    (item) => admin && (!item.capability || hasCapability(me, item.capability)),
  );
  const hasWorkspace = ownerItems.length > 0 || adminItems.length > 0;

  const activeMemberships = me.memberships.filter((membership) => membership.status === 'ACTIVE');
  const activeMembership = activeMemberships[0];

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {ownerItems.length ? (
        <div>
          <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7c89a0]">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {ownerItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
            ))}
          </ul>
        </div>
      ) : null}
      {adminItems.length ? (
        <div>
          <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7c89a0]">
            Platform
          </p>
          <ul className="space-y-0.5">
            {adminItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
            ))}
          </ul>
        </div>
      ) : null}
      {!hasWorkspace ? (
        <div className="mx-1 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px] leading-relaxed text-[#aebbd2]">
          Your account has no workspace access yet. Ask your site owner to invite you, then open Manage on
          your phone.
        </div>
      ) : null}
    </nav>
  );

  const brand = (
    <Link href={admin && !ownerItems.length ? '/admin' : '/'} className="flex items-center gap-2.5 px-4 py-4">
      <Image
        src="/brand/mark-tile.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-[9px]"
        priority
      />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-white">Manage</span>
      {admin ? <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#c3d4ff]">ADMIN</span> : null}
    </Link>
  );

  const footer = (
    <div className="border-t border-white/10 px-3 py-3">
      <div className="rounded-xl bg-white/[0.05] p-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={me.user.name} className="h-8 w-8 bg-white/10 text-[11px] text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{me.user.name}</p>
            <p className="truncate text-[11.5px] text-[#93a2bb]">{me.user.email}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#8fb4ff]">
            <IconShield className="h-3.5 w-3.5" />
            {me.user.twoFactorEnabled ? 'MFA on' : 'MFA off'}
          </span>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              router.replace('/sign-in');
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-[#aebbd2] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {signingOut ? <Spinner className="h-3.5 w-3.5" /> : <IconLogout className="h-3.5 w-3.5" />}
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-navy lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full w-[272px] flex-col bg-navy shadow-2xl">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="mr-2 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1.5 rounded-lg p-2 text-muted hover:bg-soft hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <IconMenu className="h-5 w-5" />
            </button>

            {activeMemberships.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOrgOpen((open) => !open)}
                  aria-expanded={orgOpen}
                  className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-[#c6d0e2]"
                >
                  <IconBuilding className="h-4 w-4 text-muted" />
                  <span className="max-w-[180px] truncate">{activeMembership?.organizationName ?? 'Organization'}</span>
                  <IconChevronDown className="h-3.5 w-3.5 text-muted" />
                </button>
                {orgOpen ? (
                  <div className="absolute left-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
                    {activeMemberships.map((membership) => (
                      <button
                        key={membership.organizationId}
                        type="button"
                        onClick={() => {
                          setOrgOpen(false);
                          if (membership.organizationId === me.activeOrganizationId) return;
                          void switchOrganization(membership.organizationId).then(() => router.refresh());
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-canvas',
                          membership.organizationId === me.activeOrganizationId && 'bg-soft',
                        )}
                      >
                        <span className="truncate text-ink">{membership.organizationName}</span>
                        <Badge tone="slate">{membership.role === 'SITE_OWNER' ? 'Owner' : membership.role === 'PLATFORM_ADMIN' ? 'Admin' : 'Staff'}</Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <IconBuilding className="h-4 w-4 text-muted" />
                <span className="max-w-[220px] truncate">{activeMembership?.organizationName ?? 'Manage'}</span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {!me.user.emailVerified ? (
                <Badge tone="amber">Email unconfirmed</Badge>
              ) : !me.user.twoFactorEnabled ? (
                <Link href="/mfa-setup" className="hidden sm:block">
                  <Badge tone="amber">Set up MFA</Badge>
                </Link>
              ) : null}
              <ButtonLink href="/account" variant="ghost" size="sm" className="-mr-1 text-[13px]">
                {me.user.name.split(' ')[0] ?? 'Account'}
              </ButtonLink>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
          active ? 'bg-white/10 text-white' : 'text-[#b6c2d6] hover:bg-white/[0.06] hover:text-white',
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', active ? 'text-[#9dbcff]' : 'text-[#8b9ab3]')} />
        {item.label}
      </Link>
    </li>
  );
}

function MfaSetupInterstitial() {
  const { signOut, me } = useAuth();
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card-shadow rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-warn-soft text-warn">
            <IconShield className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-ink">Two-step verification is required</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Owner and admin accounts must protect their sign-in with an authenticator app before opening the
            workspace. {me ? `Signed in as ${me.user.email}.` : null}
          </p>
          <div className="mt-5 space-y-2">
            <ButtonLink href="/mfa-setup" variant="primary" className="w-full">
              Set up two-step verification
            </ButtonLink>
            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await signOut();
                router.replace('/sign-in');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Guards a page behind a capability. Renders a denial panel rather than leaking a blank screen. */
export function RequireCapability({
  capability,
  children,
  title,
  message,
}: {
  capability: Capability;
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { me } = useAuth();
  if (!hasCapability(me, capability)) {
    return <DeniedState title={title} message={message} />;
  }
  return <>{children}</>;
}

export function WorkspaceNotice() {
  return (
    <InlineNotice tone="warn">
      Staff shift tools live in the Manage mobile app. Owners and platform admins use this workspace.
    </InlineNotice>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (!isAdmin(me)) {
    return (
      <DeniedState
        title="The platform console is for administrators"
        message="This area is limited to active platform administrator accounts with MFA enabled. If you should have access, ask another administrator to review your membership."
      />
    );
  }
  return <>{children}</>;
}
