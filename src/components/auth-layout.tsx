import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { IconBell, IconClock, IconShield } from './icons';

const POINTS = [
  {
    icon: IconClock,
    title: 'Attendance you can defend',
    body: 'Every clock-in carries its own evidence, review state, and audit trail.',
  },
  {
    icon: IconBell,
    title: 'Departure alerts that reach you',
    body: 'Durable notifications when a staff member leaves the site boundary.',
  },
  {
    icon: IconShield,
    title: 'Access that stays narrow',
    body: 'Invitation-only accounts, scoped roles, and step-up checks for sensitive actions.',
  },
];

export function AuthLayout({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hero-grid relative hidden w-[44%] max-w-[560px] flex-col justify-between bg-navy px-10 py-10 lg:flex">
        <Link href="/" className="flex items-center">
          <Image src="/brand/logo-light.png" alt="Manage" width={1900} height={449} className="h-[30px] w-auto" priority />
        </Link>

        <div className="max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8fb4ff]">
            Worksite attendance · oversight
          </p>
          <h2 className="mt-4 text-[30px] font-semibold leading-[1.18] tracking-[-0.02em] text-white">
            Know who is on site, and what happened when they left.
          </h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#9dbcff]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium text-white">{point.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#9fb0cb]">{point.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="max-w-xs text-[11.5px] leading-relaxed text-[#7f90ad]">
          Location is checked on the device and re-evaluated on the server. Manage keeps attendance, presence,
          and sync review as separate records.
        </p>
      </aside>

      <main className="flex flex-1 flex-col bg-canvas px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center">
            <Image src="/brand/logo.png" alt="Manage" width={1900} height={449} className="h-[26px] w-auto" priority />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className={wide ? 'w-full max-w-[560px]' : 'w-full max-w-[400px]'}>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{description}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>
        <p className="text-center text-[11px] text-[#8b97ab]">
          Manage · Corporate worksite attendance and remote oversight
        </p>
      </main>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="card-shadow rounded-2xl border border-line bg-white p-5 sm:p-6">{children}</div>;
}
