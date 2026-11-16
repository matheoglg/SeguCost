// Domain model of SeguCost. Mirrors the logical data model of the SRS v2.0.
// Identifiers in English; user-facing labels live in labels.ts.
// Dates are ISO strings: 'YYYY-MM-DD' for calendar dates, full ISO for timestamps.

/** The four business roles (RF-03): Administradora, Jefe de Ventas, Supervisor, Operario. */
export type Role = 'adm' | 'ven' | 'sup' | 'ope';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string; // prototype only: no real authentication (out of scope)
  role: Role;
  active: boolean;
  positionId?: string; // plant position, used for labor cost (RF-41, RF-46)
  shift?: string;
  createdAt?: string;
  /** Set when the Administradora resets the password; asked again on next login (RF-03). */
  mustChangePassword?: boolean;
}

export type MaterialType = 'resin' | 'pigment' | 'ink' | 'additive' | 'recycled';
export type MaterialUnit = 'kg' | 'lb' | 'l';

export interface Material {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  unit: MaterialUnit;
  active: boolean;
}

export type Origin = 'local' | 'imported' | 'own';

export interface Supplier {
  id: string;
  name: string;
  origin: Origin;
  contact?: string;
  active?: boolean; // undefined = active (RF-42)
}

export interface SupplierPrice {
  id: string;
  materialId: string;
  supplierId: string;
  price: number; // USD per `priceUnit` (per material unit when absent)
  priceUnit?: MaterialUnit; // a price per lb is compared converted to kg (RF-44)
  leadTimeDays?: number; // days to arrive; required when the supplier is imported (RF-43)
  includes?: string; // what the price covers: "Producto y flete", "Transporte; IVA aparte" (RF-43)
  validFrom: string;
  createdBy: string;
}

/**
 * Supplier chosen as price reference for new estimates (RF-44). The latest `since` is the one in
 * force; the price is that supplier's price in force at the estimate date.
 */
export interface ReferencePrice {
  id: string;
  materialId: string;
  supplierId: string;
  since: string;
  setBy: string;
}

export type ProductType = 'natural' | 'printed' | 'nursery';

export interface ProductLine {
  id: string;
  name: string;
  minMargin: number; // fraction, e.g. 0.2 = 20 % (RF-37)
}

export interface Product {
  id: string;
  code: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  gauge: number;
  weightG: number; // grams per unit (RF-06, RF-10)
  type: ProductType;
  lineId: string;
  active: boolean;
}

export type RecipeStatus = 'draft' | 'approved' | 'rejected';

export interface RecipeItem {
  materialId: string;
  qtyPerKg: number; // material units per kg of product (S-3)
}

export interface Recipe {
  id: string;
  productId: string;
  version: number;
  status: RecipeStatus;
  items: RecipeItem[];
  createdBy: string;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
}

export interface Customer {
  id: string;
  name: string;
  ruc: string;
}

export type SalesOrderStatus = 'pending' | 'ordered' | 'cancelled';

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  productId: string;
  quantity: number; // units
  dueDate: string;
  isService: boolean; // third-party service: customer brings the raw material (RF-13)
  receivedMaterialKg?: number;
  status: SalesOrderStatus;
  createdBy: string;
  createdAt: string;
}

export type StageType = 'extrusion' | 'printing' | 'sealing' | 'dieCutting' | 'packing';

export type OrderStatus = 'pending' | 'inProgress' | 'toValidate' | 'closed' | 'cancelled';

export interface ProductionOrder {
  id: string;
  code: string;
  salesOrderId: string;
  recipeId: string;
  weightKg: number;
  status: OrderStatus;
  createdBy: string;
  createdAt: string;
  finalCount?: number; // packing count (RF-18)
  bundles?: number;
  packedAt?: string;
  closedBy?: string;
  closedAt?: string;
  returnNote?: string; // last observation when sent back (RF-19)
}

export type StageStatus = 'pending' | 'inProgress' | 'done';

export interface OrderStage {
  id: string;
  orderId: string;
  type: StageType;
  sequence: number;
  machineId?: string; // packing has no machine
  operatorIds: string[];
  status: StageStatus;
}

export type MachineSection = Exclude<StageType, 'packing'>;

export interface Machine {
  id: string;
  code: string;
  section: MachineSection;
  active: boolean; // false = en mantenimiento (RF-25)
  kgPerHour: number; // standard throughput used to estimate hours (RF-25)
}

export interface ProductionRecord {
  id: string;
  stageId: string;
  operatorId: string;
  machineId?: string;
  rawMaterialKg?: number; // extrusion
  rollKg?: number; // extrusion
  units?: number; // printing, sealing, die cutting
  at: string;
}

export type WasteDestination = 'ground' | 'pelletized' | 'sold';

export interface WasteRecord {
  id: string;
  stageId: string;
  operatorId: string;
  kg: number;
  destination: WasteDestination;
  at: string;
}

export type PauseType = 'active' | 'rest';

export interface Pause {
  type: PauseType;
  start: string;
  end?: string; // open pause = operator currently paused
}

// Time punch of an operator on a stage (Marcacion). Open entry = running timer (RF-21).
export interface TimeEntry {
  id: string;
  stageId: string;
  operatorId: string;
  machineId?: string;
  start: string;
  end?: string;
  pauses: Pause[];
  correction?: { by: string; at: string; reason: string };
}

export interface Position {
  id: string;
  name: string;
}

// Hourly cost history; the most recent validFrom <= date is the one in force (RF-29, RF-30).
export interface PositionRate {
  id: string;
  positionId: string;
  hourlyCost: number;
  validFrom: string;
  createdBy: string;
}

export interface MachineRate {
  id: string;
  machineId: string;
  hourlyCost: number;
  validFrom: string;
  createdBy: string;
}

/** Indirect cost rate per productive hour: utilities and plant expenses (RF-41). */
export interface IndirectRate {
  id: string;
  hourlyCost: number;
  validFrom: string;
  createdBy: string;
}

export type RuleKey = 'minMargin' | 'maxWastePct' | 'balanceTolerance';

/** History of the commercial and production rules (RF-41); `value` is a fraction. */
export interface RuleRate {
  id: string;
  key: RuleKey;
  value: number;
  validFrom: string;
  createdBy: string;
}

// Standard throughput and staffing per stage, used to estimate the conversion part of the standard cost.
export interface StageStandard {
  stage: StageType;
  kgPerHour: number;
  positionId: string;
}

export interface OrderCostLine {
  kind: 'material' | 'labor' | 'machine' | 'recovery';
  refId: string; // material, operator or machine id; waste destination for recovery
  quantity: number; // material units, hours or kg
  rate: number;
  amount: number;
}

// Cost snapshot computed when the order is validated; closed orders never change (RF-34).
export interface OrderCost {
  orderId: string;
  materials: number; // CM
  labor: number; // CMO
  machine: number; // CMQ
  recovered: number; // VR
  total: number; // CT
  unitCost: number; // CU
  units: number;
  isService: boolean;
  lines: OrderCostLine[];
  computedAt: string;
}

export type MarginMethod = 'onCost' | 'onPrice';
export type PriceProposalStatus = 'proposed' | 'approved' | 'rejected';

export interface PriceProposal {
  id: string;
  productId: string;
  baseUnitCost: number;
  margin: number;
  method: MarginMethod;
  price: number;
  quantity?: number; // order size used in the simulation
  status: PriceProposalStatus;
  proposedBy: string;
  proposedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  justification?: string; // mandatory when below the line minimum (RF-37)
  rejectionReason?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  entity: string;
  entityId: string;
  action: string;
  before?: string;
  after?: string;
}

export interface DobraExport {
  id: string;
  at: string;
  userId: string;
  fileName: string;
  productIds: string[];
}

export interface Notification {
  id: string;
  userId: string;
  at: string;
  message: string;
  orderId?: string;
  read: boolean;
}

// ---- commercial (RF-12 to RF-24) ----

export type QuoteStatus = 'draft' | 'pendingAuthorization' | 'authorized' | 'rejected' | 'confirmed';
export type ExceptionStatus = 'pending' | 'authorized' | 'rejected';

export interface QuoteLine {
  id: string;
  productId: string;
  quantity: number;
  materials: number; // estimated material cost, USD (RF-45)
  transformation: number; // labor + machine + indirect, USD
  marginPct: number; // fraction over cost (RF-17)
}

/** Commercial exception: a quote line below the minimum margin (RF-18, RF-19). */
export interface QuoteException {
  lineId: string;
  marginPct: number;
  minMargin: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: ExceptionStatus;
  decidedBy?: string;
  decidedAt?: string;
  observation?: string;
}

export interface Quote {
  id: string;
  code: string;
  customerId: string;
  revision: number;
  lines: QuoteLine[];
  status: QuoteStatus;
  exception?: QuoteException;
  createdBy: string;
  createdAt: string;
}

export interface Settings {
  minMargin: number; // fraction over cost, one for all quotes (RF-41)
  balanceTolerance: number; // fraction, material balance tolerance (RF-33)
  maxWastePct: number; // fraction, waste threshold per stage (RF-41)
  localImportThreshold: number; // fraction, default 0.10 (S-4)
  marginMethod: MarginMethod; // default on cost (S-4)
  wasteRecoveryPerKg: Record<WasteDestination, number>; // USD/kg credited as VR (RF-33)
}

// Monthly aggregates used by the trend charts (W-01, W-20).
export interface MonthlyUnitCost {
  month: string; // 'YYYY-MM'
  productId: string;
  unitCost: number;
}

export interface MonthlyWaste {
  month: string;
  section: MachineSection | 'packing' | 'all'; // 'all' = weighted plant average
  wastePct: number; // fraction
}

export interface Database {
  users: User[];
  positions: Position[];
  positionRates: PositionRate[];
  materials: Material[];
  suppliers: Supplier[];
  supplierPrices: SupplierPrice[];
  referencePrices: ReferencePrice[];
  productLines: ProductLine[];
  products: Product[];
  recipes: Recipe[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  machines: Machine[];
  machineRates: MachineRate[];
  indirectRates: IndirectRate[];
  ruleRates: RuleRate[];
  quotes: Quote[];
  stageStandards: StageStandard[];
  orders: ProductionOrder[];
  stages: OrderStage[];
  productionRecords: ProductionRecord[];
  wasteRecords: WasteRecord[];
  timeEntries: TimeEntry[];
  orderCosts: OrderCost[];
  priceProposals: PriceProposal[];
  auditLog: AuditEntry[];
  dobraExports: DobraExport[];
  notifications: Notification[];
  monthlyUnitCosts: MonthlyUnitCost[];
  monthlyWaste: MonthlyWaste[];
  settings: Settings;
}
