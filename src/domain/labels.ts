// Spanish display labels for domain enums.
import type {
  MaterialType,
  MaterialUnit,
  MachineSection,
  OrderStatus,
  Origin,
  PauseType,
  PriceProposalStatus,
  ProductType,
  RecipeStatus,
  Role,
  SalesOrderStatus,
  StageStatus,
  StageType,
  WasteDestination,
} from './types';

export const roleLabels: Record<Role, string> = {
  adm: 'Administradora Principal',
  ven: 'Jefe de Ventas',
  con: 'Responsable Contable',
  fac: 'Encargada de Facturación',
  rrhh: 'Encargada de RR. HH.',
  sup: 'Supervisor de Planta',
  ope: 'Operario de Producción',
};

export const roleShortLabels: Record<Role, string> = {
  adm: 'Adm.',
  ven: 'Ventas',
  con: 'Cont.',
  fac: 'Fact.',
  rrhh: 'RR. HH.',
  sup: 'Sup.',
  ope: 'Oper.',
};

export const materialTypeLabels: Record<MaterialType, string> = {
  resin: 'Resina',
  pigment: 'Pigmento',
  ink: 'Tinta',
  additive: 'Aditivo',
  recycled: 'Reciclado',
};

export const materialUnitLabels: Record<MaterialUnit, string> = {
  kg: 'kg',
  lb: 'lb',
  l: 'litro',
};

export const originLabels: Record<Origin, string> = {
  local: 'Local',
  imported: 'Importado',
  own: 'Propio',
};

export const productTypeLabels: Record<ProductType, string> = {
  natural: 'Natural',
  printed: 'Impresa',
  nursery: 'Vivero',
};

export const recipeStatusLabels: Record<RecipeStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export const salesOrderStatusLabels: Record<SalesOrderStatus, string> = {
  pending: 'Pendiente',
  ordered: 'Con orden',
  cancelled: 'Anulado',
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  inProgress: 'En proceso',
  toValidate: 'Por validar',
  closed: 'Cerrada',
  cancelled: 'Anulada',
};

export const stageLabels: Record<StageType, string> = {
  extrusion: 'Extrusión',
  printing: 'Impresión',
  sealing: 'Sellado',
  dieCutting: 'Troquelado',
  packing: 'Empacado',
};

export const stageCodes: Record<StageType, string> = {
  extrusion: 'EXT',
  printing: 'IMP',
  sealing: 'SEL',
  dieCutting: 'TRQ',
  packing: 'EMP',
};

export const sectionLabels: Record<MachineSection, string> = {
  extrusion: 'Extrusión',
  printing: 'Impresión',
  sealing: 'Sellado',
  dieCutting: 'Troquelado',
};

export const stageStatusLabels: Record<StageStatus, string> = {
  pending: 'Pendiente',
  inProgress: 'En proceso',
  done: 'Terminada',
};

export const wasteDestinationLabels: Record<WasteDestination, string> = {
  ground: 'Molido',
  pelletized: 'Peletizado',
  sold: 'Venta a recicladora',
};

export const pauseTypeLabels: Record<PauseType, string> = {
  active: 'Pausa activa',
  rest: 'Descanso',
};

export const priceProposalStatusLabels: Record<PriceProposalStatus, string> = {
  proposed: 'Propuesta',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};
