// Permission matrix per role (SRS Table 5.1, RF-03).
// 'full' = X (acceso completo), 'read' = C (solo consulta); absent = no access.
import type { Role } from './types';

export type Feature =
  | 'users' // Usuarios, roles y bitácora
  | 'catalog' // Catálogo, recetas y aprobación
  | 'salesOrders' // Pedidos y servicios a terceros
  | 'productionOrders' // Órdenes, asignación y validación
  | 'mobileRecording' // Registro móvil (tiempos, producción, mermas)
  | 'supplierPrices' // Precios de proveedores
  | 'laborCost' // Costo de mano de obra
  | 'orderCosts' // Costos de órdenes y estándar
  | 'pricing' // Simulador y precios referenciales
  | 'priceLookup' // Consulta de costos y precios vigentes
  | 'reports' // Reportes y tablero
  | 'dobra'; // Exportación e importación (Dobra)

export type Access = 'full' | 'read';

export const featureLabels: Record<Feature, string> = {
  users: 'Usuarios, roles y bitácora',
  catalog: 'Catálogo, recetas y aprobación',
  salesOrders: 'Pedidos y servicios a terceros',
  productionOrders: 'Órdenes, asignación y validación',
  mobileRecording: 'Registro móvil (tiempos, producción, mermas)',
  supplierPrices: 'Precios de proveedores',
  laborCost: 'Costo de mano de obra',
  orderCosts: 'Costos de órdenes y estándar',
  pricing: 'Simulador y precios referenciales',
  priceLookup: 'Consulta de costos y precios vigentes',
  reports: 'Reportes y tablero',
  dobra: 'Exportación e importación (Dobra)',
};

export const permissionMatrix: Record<Feature, Partial<Record<Role, Access>>> = {
  users: { adm: 'full' },
  catalog: { adm: 'full', ven: 'read', sup: 'read' },
  salesOrders: { adm: 'full', ven: 'full', fac: 'read', sup: 'read' },
  productionOrders: { adm: 'full', ven: 'read', sup: 'full' },
  mobileRecording: { sup: 'full', ope: 'full' },
  supplierPrices: { adm: 'full', ven: 'read', con: 'full' },
  laborCost: { adm: 'full', rrhh: 'full' },
  orderCosts: { adm: 'full', ven: 'read', con: 'read', sup: 'read' },
  pricing: { adm: 'full', ven: 'full' },
  priceLookup: { adm: 'full', ven: 'read', con: 'read', fac: 'read' },
  reports: { adm: 'full', ven: 'read', con: 'read', sup: 'read' },
  dobra: { adm: 'full', con: 'full' },
};

export function accessOf(role: Role, feature: Feature): Access | undefined {
  return permissionMatrix[feature][role];
}

/** True when the role may see the feature; pass 'full' to require edit rights. */
export function can(role: Role, feature: Feature, level: Access = 'read'): boolean {
  const access = accessOf(role, feature);
  if (!access) return false;
  return level === 'read' || access === 'full';
}
