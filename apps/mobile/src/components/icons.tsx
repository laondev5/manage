import Svg, { Circle, Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type IconProps = { size?: number; color?: ColorValue; strokeWidth?: number };

function base({ size = 20 }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
}

const strokeProps = (color: ColorValue, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconOverview = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconBuilding = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4 21h16M6 21V6l6-3v18M18 21V10l-6-2M9 9v.01M9 13v.01M9 17v.01" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 5v14M5 12h14" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6ZM10 19a2 2 0 0 0 4 0" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx={12} cy={12} r={9} {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
    <Path d="M12 7v5l3 2" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3ZM9 12l2 2 4-4" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconPin = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
    <Circle cx={12} cy={10} r={2.5} {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m9 5 7 7-7 7" {...strokeProps(p.color ?? '#7C89A0', p.strokeWidth ?? 2)} />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m6 9 6 6 6-6" {...strokeProps(p.color ?? '#7C89A0', p.strokeWidth ?? 2)} />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" {...strokeProps(p.color ?? '#2457D6', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m5 12.5 4.5 4.5L19 7" {...strokeProps(p.color ?? '#2457D6', p.strokeWidth ?? 2.1)} />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 3 2.7 20h18.6L12 3Z" {...strokeProps(p.color ?? '#B54708', p.strokeWidth ?? 1.8)} />
    <Path d="M12 9v4M12 16.5v.01" {...strokeProps(p.color ?? '#B54708', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx={12} cy={12} r={9} {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
    <Path d="M12 11v5M12 8v.01" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M6 6l12 12M18 6 6 18" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 2)} />
  </Svg>
);

export const IconLogout = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx={11} cy={11} r={7} {...strokeProps(p.color ?? '#7C89A0', p.strokeWidth ?? 1.9)} />
    <Path d="m20 20-3.5-3.5" {...strokeProps(p.color ?? '#7C89A0', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconMail = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4 6h16v12H4zM4 7l8 6 8-6" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M19 12H5M11 6l-6 6 6 6" {...strokeProps(p.color ?? '#14213D', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconActivity = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M3 12h4l2.5-7 4 14L16 12h5" {...strokeProps(p.color ?? '#2457D6', p.strokeWidth ?? 1.9)} />
  </Svg>
);

export const IconScroll = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M6 4h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4ZM9 8h6M9 12h6M9 16h3" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" {...strokeProps(p.color ?? '#2457D6', p.strokeWidth ?? 1.8)} />
  </Svg>
);

export const IconBriefcase = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M4 8h16v11H4zM9 8V6h6v2M4 13h16" {...strokeProps(p.color ?? '#526078', p.strokeWidth ?? 1.8)} />
  </Svg>
);
