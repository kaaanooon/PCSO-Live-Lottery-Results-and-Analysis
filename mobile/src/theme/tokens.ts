export const palette = {
  navy950: '#002856',
  navy900: '#004B93',
  navy800: '#005CA9',
  teal700: '#0050A4',
  teal600: '#146CB4',
  teal100: '#DCEEFF',
  teal50: '#F2F8FF',
  gold500: '#F59E0B',
  gold100: '#FEF3C7',
  coral600: '#D71920',
  coral100: '#FDE7E8',
  blue600: '#0050A4',
  blue100: '#DCEEFF',
  purple600: '#D71920',
  purple100: '#FDE7E8',
  slate950: '#17202A',
  slate800: '#334155',
  slate700: '#475569',
  slate600: '#64748B',
  slate500: '#718096',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: palette.navy950,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
