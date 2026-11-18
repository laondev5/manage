type IconProps = { className?: string };

const base = (className?: string) => `h-5 w-5 ${className ?? ''}`;

function Svg({
  children,
  className,
  filled = false,
}: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={base(className)}
    >
      {children}
    </svg>
  );
}

export const IconOverview = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.6" />
    <rect x="14" y="3" width="7" height="7" rx="1.6" />
    <rect x="3" y="14" width="7" height="7" rx="1.6" />
    <rect x="14" y="14" width="7" height="7" rx="1.6" />
  </Svg>
);

export const IconBuilding = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 21V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15" />
    <path d="M16 10h2a2 2 0 0 1 2 2v9" />
    <path d="M2 21h20" />
    <path d="M8 8h4M8 12h4M8 16h4" />
  </Svg>
);

export const IconBell = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </Svg>
);

export const IconUsers = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.8M18 14.9c2 .6 3.4 2.3 3.4 4.6" />
  </Svg>
);

export const IconClock = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconShield = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3 4.8 5.7v5.6c0 4.5 3 7.9 7.2 9.7 4.2-1.8 7.2-5.2 7.2-9.7V5.7Z" />
    <path d="m9 12 2.1 2.1L15.4 10" />
  </Svg>
);

export const IconBriefcase = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="7.5" width="18" height="12" rx="2" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" />
  </Svg>
);

export const IconScroll = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M6 4h11a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2Z" />
    <path d="M6 4a2 2 0 0 0-2 2v1h2M10 9h5M10 13h5M10 17h3" />
  </Svg>
);

export const IconActivity = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 12h4l2.4-6 4.2 12 2.4-6h5" />
  </Svg>
);

export const IconLogout = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M9 5H5.8A1.8 1.8 0 0 0 4 6.8v10.4A1.8 1.8 0 0 0 5.8 19H9" />
    <path d="M15 8.5 18.5 12 15 15.5M10 12h8.5" />
  </Svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconSearch = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.6" />
    <path d="m16 16 4.4 4.4" />
  </Svg>
);

export const IconMenu = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconX = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronRight = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconChevronDown = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m5 12.5 4.4 4.4L19 7.4" />
  </Svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 4 2.8 20h18.4Z" />
    <path d="M12 10v4.4M12 17.4v.2" />
  </Svg>
);

export const IconInfo = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.4M12 7.8v.2" />
  </Svg>
);

export const IconArrowLeft = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const IconDownload = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 4v10M8 10.5l4 4 4-4M5 19h14" />
  </Svg>
);

export const IconRefresh = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M20 11a8 8 0 0 0-13.7-5.4L4 8" />
    <path d="M4 4v4h4M4 13a8 8 0 0 0 13.7 5.4L20 16" />
    <path d="M20 20v-4h-4" />
  </Svg>
);

export const IconPin = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </Svg>
);

export const IconMail = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);

export const IconLock = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5" />
  </Svg>
);

export const IconSpark = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.5 13.8 9l5.4 1.8-5.4 1.8L12 18l-1.8-5.4L4.8 10.8 10.2 9Z" />
  </Svg>
);
