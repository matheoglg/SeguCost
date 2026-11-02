// Visual tokens (AGENTS.md section 5). Text/background pairs keep a contrast of 4.5:1 or more (RNF-19).

export const colors = {
  primary: '#002855', // navy blue, SEGUPLAST
  primaryLight: '#1F4E8C',
  onPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#EEF1F6',
  border: '#C9D1DE',
  text: '#1A1F29',
  textMuted: '#4A5568',
  success: '#1B7F3B',
  successBg: '#E3F3E8',
  alert: '#B3261E',
  alertBg: '#FBE9E7',
  warning: '#8A5A00',
  warningBg: '#FFF4D6',
  activePause: '#1B7F3B', // pausa activa: green
  rest: '#1D5FA8', // descanso: blue
  restBg: '#E4EEF9',
  idle: '#5A6475',
  idleBg: '#E9ECF1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const font = {
  size: {
    sm: 14,
    md: 16, // minimum on mobile (RNF-02)
    lg: 18,
    xl: 22,
    xxl: 28,
    timer: 56,
  },
  weight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;

export const layout = {
  minTouch: 48, // dp, mobile buttons (RNF-02)
  sidebarWidth: 248,
  wideBreakpoint: 1024, // web shell with sidebar from this width
} as const;
