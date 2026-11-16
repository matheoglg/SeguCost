// Permission matrix per role (SRS v2.0, Table 6.1, RF-04).
// 'full' = X (acceso completo), 'read' = C (solo consulta); absent = no access.
import type { Role } from './types';

export type Feature =
  | 'users' // Cuentas, roles y bitácora
  | 'materials' // Materias primas e insumos
  | 'productSheets' // Fichas técnicas y fórmulas
  | 'newProductRequest' // Solicitud de producto nuevo
  | 'newProductEvaluation' // Evaluación de producto nuevo
  | 'customers' // Clientes
  | 'commercial' // Solicitudes, cotizaciones y pedidos
  | 'exceptions' // Autorización de excepciones
  | 'machines' // Máquinas
  | 'operatorAvailability' // Disponibilidad de operarios
  | 'planning' // Planificación y cierre de órdenes
  | 'closedOrderAdjust' // Ajuste de órdenes cerradas
  | 'productionRecording' // Registro de producción, mermas y tiempos
  | 'timeCorrection' // Corrección de registros de tiempo
  | 'tracking' // Seguimiento de producción
  | 'costParams' // Parámetros de costeo, proveedores y precios
  | 'estimatedCost' // Costo estimado
  | 'actualCost' // Costo real, rentabilidad y reportes económicos
  | 'productionKpis' // Indicadores productivos
  | 'csv'; // Importación y exportación CSV

export type Access = 'full' | 'read';

export const featureLabels: Record<Feature, string> = {
  users: 'Cuentas, roles y bitácora',
  materials: 'Materias primas e insumos',
  productSheets: 'Fichas técnicas y fórmulas',
  newProductRequest: 'Solicitud de producto nuevo',
  newProductEvaluation: 'Evaluación de producto nuevo',
  customers: 'Clientes',
  commercial: 'Solicitudes, cotizaciones y pedidos',
  exceptions: 'Autorización de excepciones',
  machines: 'Máquinas',
  operatorAvailability: 'Disponibilidad de operarios',
  planning: 'Planificación y cierre de órdenes',
  closedOrderAdjust: 'Ajuste de órdenes cerradas',
  productionRecording: 'Registro de producción, mermas y tiempos',
  timeCorrection: 'Corrección de registros de tiempo',
  tracking: 'Seguimiento de producción',
  costParams: 'Parámetros de costeo, proveedores y precios',
  estimatedCost: 'Costo estimado',
  actualCost: 'Costo real, rentabilidad y reportes económicos',
  productionKpis: 'Indicadores productivos',
  csv: 'Importación y exportación CSV',
};

export const permissionMatrix: Record<Feature, Partial<Record<Role, Access>>> = {
  users: { adm: 'full' },
  materials: { adm: 'full', ven: 'read', sup: 'read' },
  productSheets: { adm: 'read', ven: 'read', sup: 'full' },
  newProductRequest: { adm: 'read', ven: 'full', sup: 'read' },
  newProductEvaluation: { adm: 'read', sup: 'full' },
  customers: { adm: 'full', ven: 'full' },
  commercial: { adm: 'full', ven: 'full', sup: 'read' },
  exceptions: { adm: 'full' },
  machines: { adm: 'full', sup: 'full' },
  operatorAvailability: { adm: 'read', sup: 'full' },
  planning: { adm: 'read', sup: 'full' },
  closedOrderAdjust: { adm: 'full', sup: 'read' },
  productionRecording: { sup: 'read', ope: 'full' },
  timeCorrection: { adm: 'read', sup: 'full', ope: 'read' },
  tracking: { adm: 'full', ven: 'read', sup: 'full' },
  costParams: { adm: 'full' },
  estimatedCost: { adm: 'full', ven: 'full' },
  actualCost: { adm: 'full' },
  productionKpis: { adm: 'full', sup: 'full' },
  csv: { adm: 'full' },
};

/** Features that show money amounts; the operator never sees them (RF-04). */
export const MONEY_FEATURES: Feature[] = ['costParams', 'estimatedCost', 'actualCost', 'exceptions'];

export function accessOf(role: Role, feature: Feature): Access | undefined {
  return permissionMatrix[feature][role];
}

/** True when the role may see the feature; pass 'full' to require edit rights. */
export function can(role: Role, feature: Feature, level: Access = 'read'): boolean {
  const access = accessOf(role, feature);
  if (!access) return false;
  return level === 'read' || access === 'full';
}

/** True when the role may see costs, prices or margins. */
export const seesAmounts = (role: Role) => MONEY_FEATURES.some((f) => can(role, f));
