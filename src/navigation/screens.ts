// Screen inventory (CLAUDE.md section 6). Single source for the sidebar, breadcrumbs, role guards,
// placeholders and the capture script.
import type { IconName } from '@/components/Icon';
import type { Role } from '@/domain/types';

type Two = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21';
export type ScreenId = 'P-01' | `W-${Two}` | 'W-10b' | 'W-13b' | 'W-20b' | `M-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type MenuGroup = 'Comercial' | 'Productos' | 'Producción' | 'Costos' | 'Administración';

export interface ScreenDef {
  id: ScreenId;
  title: string;
  purpose: string;
  platform: 'web' | 'mobile' | 'both';
  /** Route pattern; ':param' is a required segment and ':param?' an optional one. */
  path: string;
  roles: Role[];
  rf: string[];
  /** Flow of CLAUDE.md section 7 where the screen is built (for placeholders). */
  flow: number;
  group?: MenuGroup;
  icon?: IconName;
  /** Sidebar label when it differs from the title. */
  menuLabel?: string;
  /** Roles that see the entry in the sidebar, when narrower than `roles` (as in the captures). */
  menuRoles?: Role[];
  /** Screen shown before this one in the breadcrumb (W-13 comes from W-12). */
  parent?: ScreenId;
}

const OFFICE: Role[] = ['adm', 'ven', 'sup'];

export const screens: ScreenDef[] = [
  { id: 'P-01', title: 'Inicio de sesión', purpose: 'Entrada única a SeguCost. Según el rol, lleva al panel web o a la aplicación móvil.', platform: 'both', path: '/login', roles: ['adm', 'ven', 'sup', 'ope'], rf: ['RF-01', 'RF-02'], flow: 1 },
  { id: 'W-01', title: 'Panel principal', purpose: 'Inicio de cada rol de oficina: lo que requiere su atención hoy.', platform: 'web', path: '/panel', roles: OFFICE, rf: ['RF-04', 'RF-37'], flow: 1, icon: 'home' },
  // Comercial
  { id: 'W-07', title: 'Solicitudes comerciales', menuLabel: 'Solicitudes', purpose: 'Registro de solicitudes con varias líneas, canal de origen, urgencia y entregas programadas.', platform: 'web', path: '/solicitudes', roles: ['ven'], rf: ['RF-12', 'RF-13', 'RF-14', 'RF-15', 'RF-24'], flow: 3, group: 'Comercial', icon: 'cart' },
  { id: 'W-08', title: 'Cotización y simulación', menuLabel: 'Cotizaciones', purpose: 'Costo estimado por línea y precio con porcentaje de ganancia sobre el costo.', platform: 'web', path: '/cotizaciones/:id?', roles: ['ven'], rf: ['RF-16', 'RF-17', 'RF-18', 'RF-45'], flow: 3, group: 'Comercial', icon: 'calculator' },
  { id: 'W-09', title: 'Excepciones comerciales', menuLabel: 'Excepciones', purpose: 'Bandeja de cotizaciones con ganancia bajo el mínimo.', platform: 'web', path: '/excepciones', roles: ['adm'], rf: ['RF-19'], flow: 3, group: 'Comercial', icon: 'checkSquare' },
  { id: 'W-10', title: 'Pedidos confirmados', purpose: 'Seguimiento de cantidades y entregas; cambios y cancelaciones según las reglas de la empresa.', platform: 'web', path: '/pedidos-confirmados/:id?', roles: ['ven', 'adm'], rf: ['RF-20', 'RF-21', 'RF-22', 'RF-23'], flow: 3, group: 'Comercial', icon: 'clipboard' },
  // Productos
  { id: 'W-04', title: 'Productos y fichas técnicas', menuLabel: 'Productos y fichas', purpose: 'Ficha técnica de cada funda con versión.', platform: 'web', path: '/productos', roles: ['sup', 'adm', 'ven'], menuRoles: ['sup', 'ven'], rf: ['RF-07', 'RF-08'], flow: 2, group: 'Productos', icon: 'bag' },
  { id: 'W-05', title: 'Fórmulas de fabricación', menuLabel: 'Fórmulas', purpose: 'Fórmula por kilogramo con versiones; el Supervisor habilita la vigente.', platform: 'web', path: '/formulas/:id?', roles: ['sup'], rf: ['RF-09'], flow: 2, group: 'Productos', icon: 'list' },
  { id: 'W-06', title: 'Productos nuevos', purpose: 'Solicitud de Ventas y evaluación técnica del Supervisor en una misma bandeja.', platform: 'web', path: '/productos-nuevos', roles: ['ven', 'sup'], rf: ['RF-10', 'RF-11'], flow: 2, group: 'Productos', icon: 'plus' },
  { id: 'W-03', title: 'Materias primas e insumos', purpose: 'Catálogo de insumos usados en fórmulas y precios.', platform: 'web', path: '/insumos', roles: ['adm'], rf: ['RF-06'], flow: 1, group: 'Productos', icon: 'box' },
  // Producción
  { id: 'W-11', title: 'Planificación de orden', menuLabel: 'Planificación', purpose: 'Orden generada desde una línea confirmada con etapas y recursos propuestos.', platform: 'web', path: '/planificacion/:id?', roles: ['sup'], rf: ['RF-26', 'RF-27', 'RF-28', 'RF-29'], flow: 4, group: 'Producción', icon: 'calendar' },
  { id: 'W-12', title: 'Seguimiento de producción', menuLabel: 'Seguimiento', purpose: 'Avance de órdenes según los últimos registros (no es monitoreo de máquinas).', platform: 'web', path: '/seguimiento', roles: ['sup', 'adm'], rf: ['RF-37', 'RF-40'], flow: 4, group: 'Producción', icon: 'gauge' },
  { id: 'W-13', title: 'Detalle y cierre de orden', purpose: 'Validación de etapas, balance de materiales y tiempos antes de cerrar.', platform: 'web', path: '/seguimiento/:id', roles: ['sup', 'adm'], rf: ['RF-33', 'RF-36', 'RF-38', 'RF-39'], flow: 6, group: 'Producción', parent: 'W-12' },
  { id: 'W-18', title: 'Indicadores productivos', menuLabel: 'Indicadores', purpose: 'Tiempos, pausas, cantidades y mermas por período.', platform: 'web', path: '/indicadores', roles: ['sup', 'adm'], rf: ['RF-48'], flow: 7, group: 'Producción', icon: 'barChart' },
  // Costos
  { id: 'W-14', title: 'Parámetros de costeo', purpose: 'Tarifas con vigencia y reglas comerciales.', platform: 'web', path: '/parametros', roles: ['adm'], rf: ['RF-25', 'RF-41'], flow: 1, group: 'Costos', icon: 'sliders' },
  { id: 'W-15', title: 'Precios de materias primas', purpose: 'Referencias de precio por proveedor llevadas a USD/kg y lo que incluyen.', platform: 'web', path: '/precios', roles: ['adm'], rf: ['RF-42', 'RF-43', 'RF-44'], flow: 1, group: 'Costos', icon: 'dollar' },
  { id: 'W-16', title: 'Costo real de orden', menuLabel: 'Costo real', purpose: 'Costo real calculado al cerrar la orden, con su base de cálculo.', platform: 'web', path: '/costo-real/:id?', roles: ['adm'], rf: ['RF-46'], flow: 7, group: 'Costos', icon: 'factory' },
  { id: 'W-17', title: 'Rentabilidad y desviaciones', menuLabel: 'Rentabilidad', purpose: 'Estimado frente a real y ganancia por orden.', platform: 'web', path: '/rentabilidad', roles: ['adm'], rf: ['RF-47'], flow: 7, group: 'Costos', icon: 'pie' },
  { id: 'W-19', title: 'Reportes económicos', purpose: 'Histórico de costo y rentabilidad por producto.', platform: 'web', path: '/reportes-economicos', roles: ['adm'], rf: ['RF-49'], flow: 7, group: 'Costos', icon: 'file' },
  // Administración
  { id: 'W-02', title: 'Usuarios y roles', purpose: 'Administración de cuentas con los cuatro roles de negocio.', platform: 'web', path: '/usuarios', roles: ['adm'], rf: ['RF-03', 'RF-04', 'RF-05'], flow: 1, group: 'Administración', icon: 'users' },
  { id: 'W-20', title: 'Importar y exportar', purpose: 'Carga inicial de clientes, insumos y productos con validación previa; exportación de costos y precios aprobados.', platform: 'web', path: '/datos', roles: ['adm'], rf: ['RF-50', 'RF-51'], flow: 1, group: 'Administración', icon: 'link' },
  { id: 'W-21', title: 'Bitácora', purpose: 'Consulta de cambios con valor anterior y nuevo.', platform: 'web', path: '/bitacora', roles: ['adm'], rf: ['RF-05'], flow: 7, group: 'Administración', icon: 'lock' },
  // Móvil
  { id: 'M-01', title: 'Mis actividades', purpose: 'Etapas asignadas al operario, separadas en pendientes, activas y concluidas.', platform: 'mobile', path: '/m/actividades', roles: ['ope'], rf: ['RF-30', 'RF-04'], flow: 5 },
  { id: 'M-02', title: 'Detalle de etapa', purpose: 'Especificación de la etapa antes de trabajar.', platform: 'mobile', path: '/m/etapa/:id', roles: ['ope'], rf: ['RF-30'], flow: 5 },
  { id: 'M-03', title: 'Registrar tiempos y pausas', purpose: 'Registro al terminar la actividad: inicio, fin y pausas.', platform: 'mobile', path: '/m/tiempos', roles: ['ope'], rf: ['RF-34', 'RF-35'], flow: 5 },
  { id: 'M-04', title: 'Registrar producción y consumos', purpose: 'Cantidad conforme y consumo real de cada insumo.', platform: 'mobile', path: '/m/consumos', roles: ['ope'], rf: ['RF-31'], flow: 5 },
  { id: 'M-05', title: 'Registrar merma', purpose: 'Merma recuperable con destino y merma no recuperable.', platform: 'mobile', path: '/m/mermas', roles: ['ope'], rf: ['RF-32'], flow: 5 },
  { id: 'M-06', title: 'Revisar y enviar', purpose: 'Resumen del registro con el balance de materiales.', platform: 'mobile', path: '/m/revisar', roles: ['ope'], rf: ['RF-33'], flow: 5 },
  { id: 'M-07', title: 'Mi turno', purpose: 'Resumen personal del turno y correcciones hechas por el Supervisor.', platform: 'mobile', path: '/m/mi-turno', roles: ['ope'], rf: ['RF-34', 'RF-36'], flow: 5 },
  { id: 'M-08', title: 'Seguimiento (Supervisor)', purpose: 'Vista móvil del seguimiento para el Supervisor en planta.', platform: 'mobile', path: '/m/seguimiento', roles: ['sup'], rf: ['RF-37'], flow: 6 },
];

export const screenById = Object.fromEntries(screens.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

export const menuGroups: MenuGroup[] = ['Comercial', 'Productos', 'Producción', 'Costos', 'Administración'];

/** Sidebar entries of a role, in screen order (RF-04, RI-01). */
export function menuFor(role: Role): ScreenDef[] {
  return screens.filter((s) => s.platform === 'web' && !s.parent && (s.menuRoles ?? s.roles).includes(role));
}

/** Path the sidebar opens: the pattern without its optional segments. */
export const menuPath = (screen: ScreenDef) => screen.path.replace(/\/:\w+\?/g, '');

/**
 * Start screen after login (CLAUDE.md section 8). The mobile screens of flows 5 and 6 are still the
 * previous version, so the operator and the supervisor on the phone keep their current start screens.
 */
export function homePath(role: Role, isWide: boolean): string {
  if (role === 'ope') return '/m/ordenes';
  if (role === 'sup' && !isWide) return '/m/planta';
  return '/panel';
}

const patternRegex = (pattern: string) =>
  new RegExp(`^${pattern.replace(/\/:\w+\?/g, '(?:/[^/]+)?').replace(/:\w+/g, '[^/]+')}/?$`);
// Patterns without parameters first, so '/seguimiento' is W-12 and '/seguimiento/op-0139' is W-13.
const byPattern = [...screens].sort((a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')));

/** Screen definition for a concrete pathname, e.g. '/seguimiento/op-0139' -> W-13. */
export function screenForPath(pathname: string): ScreenDef | undefined {
  return byPattern.find((s) => patternRegex(s.path).test(pathname));
}

/** Fills a route pattern: fillPath('/seguimiento/:id', { id: 'op-0139' }) -> '/seguimiento/op-0139'. */
export function fillPath(pattern: string, params: Record<string, string> = {}): string {
  return pattern
    .replace(/\/:(\w+)\?/g, (_, key: string) => (params[key] ? `/${encodeURIComponent(params[key])}` : ''))
    .replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? `:${key}`));
}

/** Breadcrumb of a pathname: group › parent › title, or the record code for detail pages. */
export function breadcrumbFor(pathname: string): { label: string; path?: string }[] {
  const screen = screenForPath(pathname);
  if (!screen) return [];
  if (screen.id === 'W-01') return [{ label: 'Inicio' }];
  const crumbs: { label: string; path?: string }[] = [];
  if (screen.group) crumbs.push({ label: screen.group });
  const parent = screen.parent ? screenById[screen.parent] : undefined;
  if (parent) crumbs.push({ label: parent.menuLabel ?? parent.title, path: menuPath(parent) });
  const base = menuPath(screen);
  const detail = pathname.length > base.length && pathname.startsWith(base) ? decodeURIComponent(pathname.slice(base.length + 1)) : undefined;
  if (screen.parent) crumbs.push({ label: decodeURIComponent(pathname.split('/').pop() ?? '').toUpperCase() });
  else if (detail) crumbs.push({ label: screen.menuLabel ?? screen.title, path: base }, { label: detail.toUpperCase() });
  else crumbs.push({ label: screen.menuLabel ?? screen.title });
  return crumbs;
}
