'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import Link from 'next/link';
import { IconAlert, IconCheck, IconInfo, IconSearch, IconX } from './icons';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-cobalt text-white shadow-[0_1px_2px_rgb(16_29_53/0.18)] hover:bg-[#1e4abd] focus-visible:outline-cobalt disabled:bg-[#9db2e6]',
  secondary:
    'border border-line bg-white text-ink hover:border-[#c6d0e2] hover:bg-[#fafbfe] focus-visible:outline-cobalt disabled:text-[#9aa6ba]',
  ghost: 'text-muted hover:bg-soft hover:text-ink focus-visible:outline-cobalt disabled:text-[#a9b3c4]',
  danger: 'bg-danger text-white hover:bg-[#9c1d14] focus-visible:outline-danger disabled:bg-[#e3a8a4]',
  quiet: 'bg-soft text-cobalt hover:bg-[#e2e9f8] focus-visible:outline-cobalt disabled:text-[#9db2e6]',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-[10px] px-4 text-sm',
  lg: 'h-11 gap-2 rounded-[10px] px-5 text-[15px]',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  icon,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5 animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------- inputs */

const CONTROL =
  'w-full rounded-[10px] border border-line bg-white px-3 text-sm text-ink transition-colors placeholder:text-[#98a3b6] focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/15 disabled:bg-canvas disabled:text-muted';

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-10', invalid && 'border-danger focus:border-danger focus:ring-danger/15', className)}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'min-h-[88px] py-2.5', invalid && 'border-danger focus:border-danger', className)}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'h-10 cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23526078%27 stroke-width=%271.7%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat pr-9',
        invalid && 'border-danger',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  optional = false,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[13px] font-medium text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b97ab]" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

/* -------------------------------------------------------------------- cards */

export function Card({
  className,
  children,
  as = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article';
}) {
  const Element = as;
  return (
    <Element className={cn('card-shadow rounded-2xl border border-line bg-white', className)}>{children}</Element>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- badges */

export type BadgeTone = 'blue' | 'amber' | 'red' | 'slate' | 'navy';

const BADGE_TONE: Record<BadgeTone, string> = {
  blue: 'bg-[#e8eefc] text-cobalt ring-[#cddaf6]',
  amber: 'bg-warn-soft text-warn ring-[#f6ddb8]',
  red: 'bg-danger-soft text-danger ring-[#f6c8c4]',
  slate: 'bg-[#eef1f6] text-muted ring-[#dde3ec]',
  navy: 'bg-navy text-white ring-navy',
};

export function Badge({
  tone = 'slate',
  children,
  dot = false,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- tables */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line bg-[#fafbfe] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-line px-5 py-3 align-middle text-[13.5px] text-ink', className)}>
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={cn(
          'card-shadow relative w-full rounded-t-2xl bg-white outline-none sm:rounded-2xl',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={headingId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink"
            aria-label="Close"
          >
            <IconX className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-[#fafbfe] px-5 py-3.5 sm:rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- page chrome */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <span className="text-[#b4bdcc]">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-cobalt">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* --------------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              active ? 'bg-navy text-white' : 'text-muted hover:bg-soft hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[11px] tabular',
                  active ? 'bg-white/15 text-white' : 'bg-[#eef1f6] text-muted',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- states */

export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted" role="status">
      <Spinner className="h-6 w-6 text-cobalt" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-[#e9edf4]', className)} aria-hidden="true" />;
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-shadow rounded-2xl border border-line bg-white p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-5 py-10' : 'px-6 py-16')}>
      {icon ? <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-soft text-cobalt">{icon}</div> : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'That did not load',
  message,
  onRetry,
  requestId,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  requestId?: string;
}) {
  return (
    <div className="card-shadow rounded-2xl border border-line bg-white">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <IconAlert className="h-5 w-5" />
        </div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{message}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {requestId ? (
          <p className="mt-4 font-mono text-[11px] text-[#8b97ab]">Reference {requestId}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DeniedState({
  title = 'You do not have access',
  message = 'Your account is signed in but this area needs a different role. If that looks wrong, ask your site owner or platform admin to review your access.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="card-shadow rounded-2xl border border-line bg-white">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <IconInfo className="h-5 w-5" />
        </div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{message}</p>
      </div>
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[10px] border border-[#f6c8c4] bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
      <IconAlert className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warn';
  children: ReactNode;
}) {
  const styles =
    tone === 'success'
      ? 'border-[#cddaf6] bg-[#eef3fd] text-[#1c3f9e]'
      : tone === 'warn'
        ? 'border-[#f6ddb8] bg-warn-soft text-warn'
        : 'border-line bg-canvas text-muted';
  const Icon = tone === 'success' ? IconCheck : IconInfo;
  return (
    <div className={cn('flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[13px]', styles)}>
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------ confirmation */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: ButtonVariant;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} size="sm" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* -------------------------------------------------------------- misc pieces */

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
  ...rest
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'>) {
  return (
    <input
      {...rest}
      type="checkbox"
      checked={checked}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className={cn(
        'h-4 w-4 cursor-pointer rounded border-[#c3ccdb] text-cobalt accent-cobalt disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-cobalt' : 'bg-[#cfd6e2]',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4ebfa] text-[12px] font-semibold text-cobalt',
        className,
      )}
      aria-hidden="true"
    >
      {letters || '?'}
    </span>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      icon={copied ? <IconCheck className="h-3.5 w-3.5" /> : undefined}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</p>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'warn' | 'danger' | 'blue';
  href?: string;
}) {
  const accent =
    tone === 'warn'
      ? 'bg-warn-soft text-warn'
      : tone === 'danger'
        ? 'bg-danger-soft text-danger'
        : tone === 'blue'
          ? 'bg-[#e8eefc] text-cobalt'
          : 'bg-canvas text-muted';
  const body = (
    <div className="card-shadow flex h-full items-start gap-4 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-[#c9d5ea] sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted">{label}</p>
        <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tabular">{value}</p>
        {hint ? <p className="mt-2 text-[12px] leading-snug text-muted">{hint}</p> : null}
      </div>
      {icon ? (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', accent)}>{icon}</span>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ------------------------------------------------------------------- stepper */

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  done && 'bg-cobalt text-white',
                  active && 'bg-navy text-white',
                  !done && !active && 'bg-[#eef1f6] text-muted',
                )}
              >
                {done ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden truncate text-[12.5px] sm:block',
                  active ? 'font-medium text-ink' : 'text-muted',
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className={cn('h-px flex-1', done ? 'bg-cobalt' : 'bg-line')} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ toast-ish */

const FlashContext = createContext<{ flash: (message: string) => void } | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const flash = (next: string) => {
    setMessage(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <FlashContext.Provider value={{ flash }}>
      {children}
      {message ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
            <IconCheck className="h-4 w-4 text-[#8fb4ff]" />
            {message}
          </div>
        </div>
      ) : null}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  const value = useContext(FlashContext);
  return value?.flash ?? (() => undefined);
}
