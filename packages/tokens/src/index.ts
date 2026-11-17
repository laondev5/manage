export const colors = {
  navy: '#101D35',
  navyRaised: '#1A2A49',
  navyMuted: '#33425F',
  cobalt: '#2457D6',
  cobaltPressed: '#1C46AD',
  cobaltSoft: '#E9EFFD',
  cobaltBorder: '#C9D8FA',
  canvas: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFD',
  text: '#14213D',
  textSecondary: '#526078',
  textTertiary: '#7C89A0',
  border: '#E3E8F1',
  borderStrong: '#CBD4E3',
  amber: '#B54708',
  amberSoft: '#FEF0C7',
  amberBorder: '#F7D28A',
  red: '#B42318',
  redSoft: '#FEE4E2',
  redBorder: '#F5B9B4',
  blueCheck: '#1D4ED8',
  blueCheckSoft: '#E8EEFD',
  overlay: 'rgba(16, 29, 53, 0.48)',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8 },
} as const;

export const touchTarget = {
  minimum: 44,
  primaryAction: 56,
} as const;

export const shadows = {
  card: {
    shadowColor: '#101D35',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#101D35',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

export const brand = {
  name: 'Manage',
  tagline: 'Worksite attendance with a clear record.',
} as const;
