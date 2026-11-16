// Visual tokens copied from the approved Figma design (CLAUDE.md section 5).
// Text/background pairs keep a contrast of 4.5:1 or more (RNF-19).

export const colors = {
  primary: '#002855', // azul SEGUPLAST: botones, barra móvil, menú lateral
  primaryLight: '#1F5FA8',
  selected: '#123F73', // ítem activo del menú lateral
  gold: '#F2A900', // marca: logo e ícono del ítem activo
  onPrimary: '#FFFFFF',
  page: '#F5F7FA', // fondo de las pantallas
  background: '#FFFFFF', // tarjetas, campos y tablas
  surface: '#EEF1F6', // encabezados de tabla, bloques internos
  border: '#DDE3EA',
  inputBorder: '#9AA5B4',
  text: '#1A2433',
  textMuted: '#5B6676',
  success: '#1B7F3B',
  successBg: '#E3F1E6',
  alert: '#B3261E',
  alertBg: '#FAE6E4',
  warning: '#8A5A00',
  warningBg: '#FFF2CC',
  info: '#1F5FA8',
  infoBg: '#E3ECF7',
  activePause: '#1B7F3B', // pausa activa: verde (móvil y reportes)
  rest: '#1F5FA8', // descanso: azul
  restBg: '#E3ECF7',
  idle: '#5B6676',
  idleBg: '#E9ECF1',
  sidebarMuted: '#9FB0C6',
} as const;

/** Chart series: navy, info blue, gold, green (W-15, W-17, W-18, W-19). */
export const chartColors = ['#002855', '#1F5FA8', '#F2A900', '#1B7F3B'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24, // card padding (CLAUDE.md section 5)
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const font = {
  family: 'Inter',
  size: {
    xs: 12,
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
    semibold: '600',
    bold: '700',
  },
} as const;

export const layout = {
  minTouch: 48, // dp, mobile controls (RNF-02)
  sidebarWidth: 248,
  headerHeight: 64,
  wideBreakpoint: 1024, // web shell with sidebar from this width
} as const;
