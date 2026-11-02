// Screen inventory (AGENTS.md section 6). Single source for menus, role guards,
// placeholders and the capture script.
import type { Role } from '@/domain/types';

export type ScreenId =
  | 'P-01'
  | `W-${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22'}`
  | `M-${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08'}`;

export type MenuGroup = 'Inicio' | 'Catálogo' | 'Producción' | 'Costos' | 'Precios' | 'Reportes' | 'Administración';

export interface ScreenDef {
  id: ScreenId;
  title: string;
  purpose: string;
  platform: 'web' | 'mobile' | 'both';
  /** Route pattern; ':param' marks dynamic segments. */
  path: string;
  roles: Role[];
  rf: string[];
  /** Web sidebar group; screens without it are reached from other screens. */
  menu?: MenuGroup;
}

const OFFICE: Role[] = ['adm', 'ven', 'con', 'fac', 'rrhh', 'sup'];
const ALL: Role[] = [...OFFICE, 'ope'];

export const screens: ScreenDef[] = [
  { id: 'P-01', title: 'Inicio de sesión', purpose: 'Entrada única a SeguCost. Según el rol, lleva al panel web o a la app móvil.', platform: 'both', path: '/login', roles: ALL, rf: ['RF-01', 'RF-03'] },
  { id: 'W-01', title: 'Panel principal', purpose: 'Pantalla de inicio de cada rol de oficina con indicadores y accesos a sus tareas.', platform: 'web', path: '/panel', roles: OFFICE, rf: ['RF-03', 'RF-42'], menu: 'Inicio' },
  { id: 'W-02', title: 'Usuarios y roles', purpose: 'Administración de cuentas y consulta de la matriz de permisos.', platform: 'web', path: '/usuarios', roles: ['adm'], rf: ['RF-02', 'RF-03'], menu: 'Administración' },
  { id: 'W-03', title: 'Materias primas e insumos', purpose: 'Catálogo de materiales usados en recetas y precios.', platform: 'web', path: '/insumos', roles: ['adm'], rf: ['RF-05'], menu: 'Catálogo' },
  { id: 'W-04', title: 'Fundas', purpose: 'Catálogo de productos con sus especificaciones.', platform: 'web', path: '/fundas', roles: ['adm', 'sup'], rf: ['RF-06'], menu: 'Catálogo' },
  { id: 'W-05', title: 'Recetas (BOM)', purpose: 'Edición de la receta por kilogramo y consulta de versiones.', platform: 'web', path: '/recetas/:funda', roles: ['adm', 'sup'], rf: ['RF-07'] },
  { id: 'W-06', title: 'Aprobación de recetas', purpose: 'Bandeja de recetas en borrador para aprobar o rechazar.', platform: 'web', path: '/recetas/aprobacion', roles: ['adm'], rf: ['RF-08', 'RF-04'], menu: 'Catálogo' },
  { id: 'W-07', title: 'Pedidos', purpose: 'Registro de pedidos de clientes y servicios a terceros con conversión a peso.', platform: 'web', path: '/pedidos', roles: ['adm', 'ven', 'sup'], rf: ['RF-09', 'RF-10', 'RF-13'], menu: 'Producción' },
  { id: 'W-08', title: 'Órdenes de producción', purpose: 'Generación de la orden con su ruta y asignación de máquina y operarios por etapa.', platform: 'web', path: '/ordenes/nueva', roles: ['sup'], rf: ['RF-11', 'RF-12', 'RF-20'], menu: 'Producción' },
  { id: 'W-09', title: 'Detalle y validación de orden', purpose: 'Seguimiento de una orden y validación de su cierre.', platform: 'web', path: '/ordenes/:id', roles: ['sup', 'adm'], rf: ['RF-15', 'RF-16', 'RF-17', 'RF-19', 'RF-20', 'RF-22'] },
  { id: 'W-10', title: 'Monitor de planta', purpose: 'Estado de cada máquina en tiempo real.', platform: 'web', path: '/planta', roles: ['sup'], rf: ['RF-25'], menu: 'Producción' },
  { id: 'W-11', title: 'Proveedores y precios', purpose: 'Registro de precios por proveedor y su historial.', platform: 'web', path: '/precios', roles: ['con', 'adm'], rf: ['RF-26', 'RF-27'], menu: 'Costos' },
  { id: 'W-12', title: 'Comparador local vs. importado', purpose: 'Apoyo a la decisión de compra.', platform: 'web', path: '/precios/comparar', roles: ['adm', 'con'], rf: ['RF-28'], menu: 'Costos' },
  { id: 'W-13', title: 'Costos de recursos', purpose: 'Costo por hora de cargos de planta y de máquinas.', platform: 'web', path: '/recursos', roles: ['adm', 'rrhh'], rf: ['RF-29', 'RF-30'], menu: 'Costos' },
  { id: 'W-14', title: 'Costeo de orden', purpose: 'Resultado del costeo automático de una orden cerrada.', platform: 'web', path: '/costos/ordenes/:id', roles: ['adm', 'ven', 'con', 'sup'], rf: ['RF-31', 'RF-32', 'RF-33', 'RF-35'] },
  { id: 'W-15', title: 'Impacto de cambio de precio', purpose: 'Recálculo de costos estándar tras actualizar un precio.', platform: 'web', path: '/costos/impacto', roles: ['adm', 'con'], rf: ['RF-34'], menu: 'Costos' },
  { id: 'W-16', title: 'Simulador de márgenes', purpose: 'Cálculo del precio de venta con distintos márgenes.', platform: 'web', path: '/precios/simulador', roles: ['ven', 'adm'], rf: ['RF-36', 'RF-37'], menu: 'Precios' },
  { id: 'W-17', title: 'Aprobación de precios', purpose: 'Bandeja de propuestas de precio referencial.', platform: 'web', path: '/precios/aprobacion', roles: ['adm'], rf: ['RF-37', 'RF-38', 'RF-04'], menu: 'Precios' },
  { id: 'W-18', title: 'Costos y precios vigentes', purpose: 'Consulta de solo lectura para facturación y ventas.', platform: 'web', path: '/consulta', roles: ['fac', 'ven', 'con', 'adm'], rf: ['RF-39'], menu: 'Precios' },
  { id: 'W-19', title: 'Reportes de tiempos', purpose: 'Análisis de tiempo efectivo, pausas y uso de máquinas.', platform: 'web', path: '/reportes/tiempos', roles: ['adm', 'sup'], rf: ['RF-40', 'RF-41'], menu: 'Reportes' },
  { id: 'W-20', title: 'Tablero de costos y mermas', purpose: 'Evolución de costos, precios de insumos y mermas.', platform: 'web', path: '/reportes/tablero', roles: ['adm', 'con'], rf: ['RF-42'], menu: 'Reportes' },
  { id: 'W-21', title: 'Integración con Dobra', purpose: 'Exportación de costos y precios, e importación del catálogo inicial.', platform: 'web', path: '/integracion', roles: ['adm', 'con'], rf: ['RF-43', 'RF-44', 'RF-04'], menu: 'Administración' },
  { id: 'W-22', title: 'Bitácora', purpose: 'Consulta de operaciones registradas.', platform: 'web', path: '/bitacora', roles: ['adm'], rf: ['RF-04'], menu: 'Administración' },
  { id: 'M-01', title: 'Mis órdenes', purpose: 'Lista de etapas asignadas al operario.', platform: 'mobile', path: '/m/ordenes', roles: ['ope', 'sup'], rf: ['RF-14', 'RF-03'] },
  { id: 'M-02', title: 'Detalle de etapa', purpose: 'Información de la etapa antes de empezar.', platform: 'mobile', path: '/m/etapas/:id', roles: ['ope'], rf: ['RF-14', 'RF-21'] },
  { id: 'M-03', title: 'Operación en curso', purpose: 'Cronómetro de trabajo con pausas diferenciadas.', platform: 'mobile', path: '/m/operacion', roles: ['ope'], rf: ['RF-21', 'RF-23'] },
  { id: 'M-04', title: 'Registrar producción', purpose: 'Ingreso de lo producido en la etapa.', platform: 'mobile', path: '/m/produccion', roles: ['ope'], rf: ['RF-15'] },
  { id: 'M-05', title: 'Registrar merma', purpose: 'Ingreso de desperdicio y su destino.', platform: 'mobile', path: '/m/merma', roles: ['ope'], rf: ['RF-16', 'RF-17'] },
  { id: 'M-06', title: 'Cierre en empacado', purpose: 'Conteo final de la orden.', platform: 'mobile', path: '/m/cierre', roles: ['ope'], rf: ['RF-18'] },
  { id: 'M-07', title: 'Resumen de turno', purpose: 'Resumen personal del turno.', platform: 'mobile', path: '/m/turno', roles: ['ope'], rf: ['RF-24'] },
  { id: 'M-08', title: 'Planta (supervisor)', purpose: 'Vista móvil del estado de máquinas para el supervisor en planta.', platform: 'mobile', path: '/m/planta', roles: ['sup'], rf: ['RF-25', 'RF-17'] },
];

export const screenById = Object.fromEntries(screens.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

export const menuGroups: MenuGroup[] = ['Inicio', 'Catálogo', 'Producción', 'Costos', 'Precios', 'Reportes', 'Administración'];

/** Web sidebar entries for a role, filtered by the screen's roles (RF-03, RI-01). */
export function menuFor(role: Role): ScreenDef[] {
  return screens.filter((s) => s.menu && s.roles.includes(role));
}

/** Start screen after login (AGENTS.md sections 3 and 8). */
export function homePath(role: Role, isWide: boolean): string {
  switch (role) {
    case 'ope':
      return '/m/ordenes';
    case 'sup':
      return isWide ? '/planta' : '/m/planta';
    case 'fac':
      return '/consulta';
    case 'rrhh':
      return '/recursos';
    default:
      return '/panel';
  }
}

/** Fills a route pattern: fillPath('/ordenes/:id', { id: 'op-0003' }) -> '/ordenes/op-0003'. */
export function fillPath(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? `:${key}`));
}
