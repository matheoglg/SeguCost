// Demo data (CLAUDE.md section 8). All names are fictitious.
// Dates are generated relative to `now` so the demo always shows a running shift,
// a recent history and the last 6 months of trends.
import { unitsToWeight } from '@/domain/conversion';
import { stageCodes } from '@/domain/labels';
import { round4 } from '@/domain/rounding';
import { buildRoute } from '@/domain/routing';
import type {
  AuditEntry,
  Database,
  MachineRate,
  MarginMethod,
  MonthlyUnitCost,
  MonthlyWaste,
  OrderStage,
  Pause,
  PositionRate,
  PriceProposal,
  ProductionOrder,
  Quote,
  ProductionRecord,
  SalesOrder,
  StageStatus,
  StageType,
  SupplierPrice,
  TimeEntry,
  WasteDestination,
  WasteRecord,
} from '@/domain/types';

export const DEMO_PASSWORD = 'demo123';

/** Prototype quick access in P-01: office roles on the web, operators on the phone. */
export const QUICK_ACCESS_WEB = ['admin', 'ventas', 'supervisor'] as const;
export const QUICK_ACCESS_MOBILE = ['operario1', 'operario2', 'supervisor'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const seq4 = (n: number) => String(n).padStart(4, '0');

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createSeed(now: Date = new Date()): Database {
  // ---- date helpers (local time) ----
  const at = (dayOffset: number, hh: number, mm = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const day = (dayOffset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    return localDate(d);
  };
  const monthDate = (monthOffset: number) => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStart = (monthOffset: number) => localDate(monthDate(monthOffset));
  const monthKey = (monthOffset: number) => monthStart(monthOffset).slice(0, 7);
  /** Timestamp inside a past month, used for approvals and audit entries. */
  const inMonth = (monthOffset: number, dayOfMonth: number, hh = 10) => {
    const d = monthDate(monthOffset);
    d.setDate(dayOfMonth);
    d.setHours(hh, 0, 0, 0);
    return d.toISOString();
  };
  const SIX_MONTHS = [-5, -4, -3, -2, -1, 0];

  // ---- users and positions ----
  const shift = 'Turno 07:00–15:00';
  const created = monthStart(-8);
  const users: Database['users'] = [
    { id: 'u-admin', name: 'Bélgica Loza', username: 'admin', password: DEMO_PASSWORD, role: 'adm', active: true, createdAt: created },
    { id: 'u-ventas', name: 'Daniel Ríos', username: 'ventas', password: DEMO_PASSWORD, role: 'ven', active: true, createdAt: created },
    { id: 'u-supervisor', name: 'Jorge Castillo', username: 'supervisor', password: DEMO_PASSWORD, role: 'sup', active: true, shift, createdAt: created },
    { id: 'u-op1', name: 'Luis Bravo', username: 'operario1', password: DEMO_PASSWORD, role: 'ope', active: true, positionId: 'pos-ext', shift, createdAt: created },
    { id: 'u-op2', name: 'Pedro Alvarado', username: 'operario2', password: DEMO_PASSWORD, role: 'ope', active: true, positionId: 'pos-sel', shift, createdAt: created },
    { id: 'u-op3', name: 'Carlos Vera', username: 'operario3', password: DEMO_PASSWORD, role: 'ope', active: false, positionId: 'pos-ext', shift, createdAt: created },
    { id: 'u-op4', name: 'Ana Ruiz', username: 'aruiz', password: DEMO_PASSWORD, role: 'ope', active: true, positionId: 'pos-imp', shift, createdAt: created },
  ];

  const positions: Database['positions'] = [
    { id: 'pos-ext', name: 'Operario de extrusión' },
    { id: 'pos-imp', name: 'Operario de impresión' },
    { id: 'pos-sel', name: 'Operario de sellado' },
    { id: 'pos-emp', name: 'Operario de empacado' },
  ];

  // [positionId, rate in force since March, current rate, month of the current rate].
  // Extrusion went from 2,95 to 3,10 USD/h this month (W-14, W-21).
  const positionRateRows: [string, number, number, number][] = [
    ['pos-ext', 2.95, 3.1, 0],
    ['pos-imp', 3.1, 3.25, -8],
    ['pos-sel', 2.8, 2.95, -8],
    ['pos-emp', 2.65, 2.8, -8],
  ];
  const positionRates: PositionRate[] = positionRateRows.flatMap(([positionId, prev, curr, since]) => [
    { id: `pr-${positionId}-1`, positionId, hourlyCost: prev, validFrom: monthStart(since === 0 ? -8 : -20), createdBy: 'u-admin' },
    { id: `pr-${positionId}-2`, positionId, hourlyCost: curr, validFrom: monthStart(since), createdBy: 'u-admin' },
  ]);

  // ---- materials, suppliers and prices ----
  // ADT-02 (aditivo deslizante) is not here: it arrives with the initial CSV import of flow 1.
  const materials: Database['materials'] = [
    { id: 'm-pebd', code: 'PEBD', name: 'Polietileno baja densidad', type: 'resin', unit: 'kg', active: true },
    { id: 'm-pead', code: 'PEAD', name: 'Polietileno alta densidad', type: 'resin', unit: 'kg', active: true },
    { id: 'm-rec', code: 'REC', name: 'Reciclado peletizado', type: 'recycled', unit: 'kg', active: true },
    { id: 'm-pign', code: 'PIG-N', name: 'Pigmento negro', type: 'pigment', unit: 'kg', active: true },
    { id: 'm-tinta', code: 'TINTA', name: 'Tinta flexográfica', type: 'ink', unit: 'l', active: true },
  ];

  const suppliers: Database['suppliers'] = [
    { id: 's-litoral', name: 'Plásticos del Litoral', origin: 'local', contact: 'ventas@litoral.example' },
    { id: 's-gye', name: 'Distribuidora Polímeros GYE', origin: 'local', contact: '04-000-0000' },
    { id: 's-andinas', name: 'Resinas Andinas Import.', origin: 'imported', contact: 'import@andinas.example' },
    { id: 's-global', name: 'Global Resins (demo)', origin: 'imported', contact: 'sales@global.example' },
    { id: 's-propio', name: 'Planta SEGUPLAST (reciclado propio)', origin: 'own' },
    { id: 's-pacifico', name: 'Colorantes del Pacífico', origin: 'local' },
    { id: 's-tintas', name: 'Tintas Flexo Guayaquil', origin: 'local' },
  ];

  // Monthly price series, oldest first. The last value of Plásticos del Litoral (PEBD 1,58) was
  // registered yesterday from a purchase invoice; the rest are in force since the first of each month.
  const LOCAL = 'Transporte; IVA aparte';
  const IMPORTED = 'Producto y flete';
  const priceSeries: { materialId: string; supplierId: string; leadTimeDays: number; includes: string; prices: number[]; lastFrom?: string }[] = [
    { materialId: 'm-pebd', supplierId: 's-litoral', leadTimeDays: 2, includes: LOCAL, prices: [1.46, 1.48, 1.47, 1.5, 1.5, 1.58], lastFrom: day(-1) },
    { materialId: 'm-pebd', supplierId: 's-gye', leadTimeDays: 1, includes: LOCAL, prices: [1.5, 1.52, 1.52, 1.55, 1.57, 1.61] },
    { materialId: 'm-pebd', supplierId: 's-andinas', leadTimeDays: 35, includes: IMPORTED, prices: [1.36, 1.37, 1.4, 1.39, 1.39, 1.4] },
    { materialId: 'm-pebd', supplierId: 's-global', leadTimeDays: 45, includes: IMPORTED, prices: [1.42, 1.42, 1.43, 1.43, 1.44, 1.44] },
    { materialId: 'm-pead', supplierId: 's-litoral', leadTimeDays: 2, includes: LOCAL, prices: [1.55, 1.56, 1.58, 1.6, 1.6, 1.62] },
    { materialId: 'm-pead', supplierId: 's-andinas', leadTimeDays: 40, includes: IMPORTED, prices: [1.4, 1.41, 1.43, 1.44, 1.44, 1.45] },
    { materialId: 'm-rec', supplierId: 's-propio', leadTimeDays: 0, includes: 'Material propio peletizado', prices: [0.58, 0.58, 0.59, 0.59, 0.6, 0.6] },
    { materialId: 'm-pign', supplierId: 's-pacifico', leadTimeDays: 3, includes: LOCAL, prices: [3.05, 3.05, 3.1, 3.1, 3.15, 3.2] },
    { materialId: 'm-tinta', supplierId: 's-tintas', leadTimeDays: 2, includes: LOCAL, prices: [9.4, 9.4, 9.55, 9.6, 9.7, 9.8] },
  ];
  const supplierPrices: SupplierPrice[] = priceSeries.flatMap(({ materialId, supplierId, leadTimeDays, includes, prices, lastFrom }) =>
    prices.map((price, i) => ({
      id: `sp-${materialId.slice(2)}-${supplierId.slice(2)}-${i + 1}`,
      materialId,
      supplierId,
      price,
      leadTimeDays,
      includes,
      validFrom: i === prices.length - 1 && lastFrom ? lastFrom : monthStart(SIX_MONTHS[i]),
      createdBy: 'u-admin',
    })),
  );

  // Reference supplier per material, used by the estimates (RF-44).
  const referencePrices: Database['referencePrices'] = [
    { id: 'ref-pebd', materialId: 'm-pebd', supplierId: 's-litoral', since: monthStart(-8), setBy: 'u-admin' },
    { id: 'ref-pead', materialId: 'm-pead', supplierId: 's-litoral', since: monthStart(-8), setBy: 'u-admin' },
    { id: 'ref-rec', materialId: 'm-rec', supplierId: 's-propio', since: monthStart(-8), setBy: 'u-admin' },
    { id: 'ref-pign', materialId: 'm-pign', supplierId: 's-pacifico', since: monthStart(-8), setBy: 'u-admin' },
    { id: 'ref-tinta', materialId: 'm-tinta', supplierId: 's-tintas', since: monthStart(-8), setBy: 'u-admin' },
  ];

  // ---- product lines, products and recipes ----
  const productLines: Database['productLines'] = [
    { id: 'ln-com', name: 'Comercial', minMargin: 0.2 },
    { id: 'ln-imp', name: 'Impresas personalizadas', minMargin: 0.25 },
    { id: 'ln-agr', name: 'Agrícola', minMargin: 0.18 },
    { id: 'ln-rec', name: 'Reciclada', minMargin: 0.15 },
  ];

  const products: Database['products'] = [
    { id: 'p-fn2030', code: 'FN-2030', name: 'Funda natural 20x30', widthCm: 20, lengthCm: 30, gauge: 1.5, weightG: 4.0, type: 'natural', lineId: 'ln-com', active: true },
    { id: 'p-fi4060', code: 'FI-4060', name: 'Funda impresa 40x60 con logo', widthCm: 40, lengthCm: 60, gauge: 2.0, weightG: 12.5, type: 'printed', lineId: 'ln-imp', active: true },
    { id: 'p-fv1520', code: 'FV-1520', name: 'Funda de vivero 15x20', widthCm: 15, lengthCm: 20, gauge: 2.5, weightG: 6.0, type: 'nursery', lineId: 'ln-agr', active: true },
    { id: 'p-fb2636', code: 'FB-2636', name: 'Funda de basura negra 26x36 (reciclada)', widthCm: 26, lengthCm: 36, gauge: 1.2, weightG: 8.0, type: 'natural', lineId: 'ln-rec', active: true },
  ];
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  const recipes: Database['recipes'] = [
    {
      id: 'r-fn2030-v1', productId: 'p-fn2030', version: 1, status: 'approved',
      items: [{ materialId: 'm-pebd', qtyPerKg: 0.85 }, { materialId: 'm-pead', qtyPerKg: 0.15 }],
      createdBy: 'u-admin', createdAt: inMonth(-5, 3, 9), decidedBy: 'u-admin', decidedAt: inMonth(-5, 3, 11),
    },
    {
      id: 'r-fi4060-v1', productId: 'p-fi4060', version: 1, status: 'approved',
      items: [{ materialId: 'm-pebd', qtyPerKg: 0.92 }, { materialId: 'm-pead', qtyPerKg: 0.08 }, { materialId: 'm-tinta', qtyPerKg: 0.01 }],
      createdBy: 'u-admin', createdAt: inMonth(-5, 3, 9), decidedBy: 'u-admin', decidedAt: inMonth(-5, 3, 11),
    },
    {
      id: 'r-fi4060-v2', productId: 'p-fi4060', version: 2, status: 'approved',
      items: [{ materialId: 'm-pebd', qtyPerKg: 0.9 }, { materialId: 'm-pead', qtyPerKg: 0.1 }, { materialId: 'm-tinta', qtyPerKg: 0.012 }],
      createdBy: 'u-admin', createdAt: inMonth(-2, 10, 9), decidedBy: 'u-admin', decidedAt: inMonth(-2, 10, 15),
    },
    {
      id: 'r-fv1520-v1', productId: 'p-fv1520', version: 1, status: 'approved',
      items: [{ materialId: 'm-pebd', qtyPerKg: 0.6 }, { materialId: 'm-rec', qtyPerKg: 0.35 }, { materialId: 'm-pign', qtyPerKg: 0.05 }],
      createdBy: 'u-admin', createdAt: inMonth(-5, 4, 9), decidedBy: 'u-admin', decidedAt: inMonth(-5, 4, 11),
    },
    {
      id: 'r-fb2636-v1', productId: 'p-fb2636', version: 1, status: 'approved',
      items: [{ materialId: 'm-rec', qtyPerKg: 0.8 }, { materialId: 'm-pebd', qtyPerKg: 0.17 }, { materialId: 'm-pign', qtyPerKg: 0.03 }],
      createdBy: 'u-admin', createdAt: inMonth(-5, 4, 9), decidedBy: 'u-admin', decidedAt: inMonth(-5, 4, 11),
    },
    // Draft waiting in W-06: more recycled material, less virgin resin.
    {
      id: 'r-fb2636-v2', productId: 'p-fb2636', version: 2, status: 'draft',
      items: [{ materialId: 'm-rec', qtyPerKg: 0.85 }, { materialId: 'm-pebd', qtyPerKg: 0.12 }, { materialId: 'm-pign', qtyPerKg: 0.03 }],
      createdBy: 'u-admin', createdAt: at(-1, 16, 20),
    },
  ];

  // ---- customers and sales orders ----
  const customers: Database['customers'] = [
    { id: 'c-comercial', name: 'Comercial Ejemplo S.A.', ruc: '0990000001001' },
    { id: 'c-distribuidora', name: 'Distribuidora Ficticia Cía. Ltda.', ruc: '0990000002001' },
    { id: 'c-agricola', name: 'Agrícola Demo S.A.', ruc: '0990000003001' },
    { id: 'c-super', name: 'Supermercados Muestra S.A.', ruc: '0990000004001' },
    { id: 'c-plasticos', name: 'Plásticos Prueba S.A.', ruc: '0990000005001' },
  ];

  const salesOrder = (
    n: number, customerId: string, productId: string, quantity: number,
    dueIn: number, createdDaysAgo: number, status: SalesOrder['status'], receivedMaterialKg?: number,
  ): SalesOrder => ({
    id: `ped-${seq4(n)}`,
    code: `PED-${seq4(n)}`,
    customerId, productId, quantity,
    dueDate: day(dueIn),
    isService: receivedMaterialKg !== undefined,
    receivedMaterialKg,
    status,
    createdBy: 'u-ventas',
    createdAt: at(-createdDaysAgo, 9, 15),
  });

  const salesOrders: SalesOrder[] = [
    salesOrder(1, 'c-agricola', 'p-fv1520', 20_000, -15, 26, 'ordered'),
    salesOrder(2, 'c-plasticos', 'p-fn2030', 15_000, -8, 16, 'ordered', 62),
    salesOrder(3, 'c-super', 'p-fi4060', 8_000, 3, 7, 'ordered'),
    salesOrder(4, 'c-distribuidora', 'p-fn2030', 25_000, 5, 3, 'ordered'),
    salesOrder(5, 'c-distribuidora', 'p-fb2636', 12_500, 9, 2, 'ordered'),
    // Prepared case for flow 3: 10.000 × 12,5 g = 125,00 kg / 275,58 lb.
    salesOrder(6, 'c-comercial', 'p-fi4060', 10_000, 14, 0, 'pending'),
    salesOrder(7, 'c-agricola', 'p-fv1520', 30_000, 21, 1, 'pending'),
  ];
  const salesOrderById = Object.fromEntries(salesOrders.map((s) => [s.id, s]));

  // ---- machines and rates ----
  // Standard throughput in kg/h estimates the hours of each stage (RF-25).
  const machines: Database['machines'] = [
    { id: 'mc-ext01', code: 'EXT-01', section: 'extrusion', active: true, kgPerHour: 25 },
    { id: 'mc-ext02', code: 'EXT-02', section: 'extrusion', active: true, kgPerHour: 25 },
    { id: 'mc-imp01', code: 'IMP-01', section: 'printing', active: true, kgPerHour: 40 },
    { id: 'mc-sel01', code: 'SEL-01', section: 'sealing', active: true, kgPerHour: 20 },
    { id: 'mc-sel02', code: 'SEL-02', section: 'sealing', active: true, kgPerHour: 20 },
    { id: 'mc-trq01', code: 'TRQ-01', section: 'dieCutting', active: true, kgPerHour: 30 },
  ];

  // [machineId, previous rate, current rate]; current in force since March.
  const machineRateRows: [string, number, number][] = [
    ['mc-ext01', 8.0, 8.5],
    ['mc-ext02', 8.0, 8.5],
    ['mc-imp01', 9.5, 10.0],
    ['mc-sel01', 4.75, 5.0],
    ['mc-sel02', 4.75, 5.0],
    ['mc-trq01', 3.8, 4.0],
  ];
  const machineRates: MachineRate[] = machineRateRows.flatMap(([machineId, prev, curr]) => [
    { id: `mr-${machineId}-1`, machineId, hourlyCost: prev, validFrom: monthStart(-20), createdBy: 'u-admin' },
    { id: `mr-${machineId}-2`, machineId, hourlyCost: curr, validFrom: monthStart(-8), createdBy: 'u-admin' },
  ]);

  // Utilities and plant expenses per productive hour; no salaries or payroll data (RF-41).
  const indirectRates: Database['indirectRates'] = [
    { id: 'ind-1', hourlyCost: 2.25, validFrom: monthStart(-20), createdBy: 'u-admin' },
    { id: 'ind-2', hourlyCost: 2.4, validFrom: monthStart(-8), createdBy: 'u-admin' },
  ];

  const ruleRates: Database['ruleRates'] = [
    { id: 'rule-margin-1', key: 'minMargin', value: 0.2, validFrom: monthStart(-8), createdBy: 'u-admin' },
    { id: 'rule-waste-1', key: 'maxWastePct', value: 0.03, validFrom: monthStart(-8), createdBy: 'u-admin' },
    { id: 'rule-balance-1', key: 'balanceTolerance', value: 0.005, validFrom: monthStart(-8), createdBy: 'u-admin' },
  ];

  const stageStandards: Database['stageStandards'] = [
    { stage: 'extrusion', kgPerHour: 25, positionId: 'pos-ext' },
    { stage: 'printing', kgPerHour: 30, positionId: 'pos-imp' },
    { stage: 'sealing', kgPerHour: 20, positionId: 'pos-sel' },
    { stage: 'dieCutting', kgPerHour: 30, positionId: 'pos-sel' },
    { stage: 'packing', kgPerHour: 60, positionId: 'pos-emp' },
  ];

  // ---- production orders ----
  const orders: ProductionOrder[] = [];
  const stages: OrderStage[] = [];
  const productionRecords: ProductionRecord[] = [];
  const wasteRecords: WasteRecord[] = [];
  const timeEntries: TimeEntry[] = [];

  type StagePlan = { machineId?: string; operatorIds: string[]; status: StageStatus };
  const stageId = (orderId: string, type: StageType) => `${orderId}-${stageCodes[type].toLowerCase()}`;

  const addOrder = (
    n: number,
    salesOrderId: string,
    recipeId: string,
    status: ProductionOrder['status'],
    createdAt: string,
    plan: Partial<Record<StageType, StagePlan>>,
    extra: Partial<ProductionOrder> = {},
  ) => {
    const so = salesOrderById[salesOrderId];
    const product = productById[so.productId];
    const id = `op-${seq4(n)}`;
    orders.push({
      id,
      code: `OP-${seq4(n)}`,
      salesOrderId,
      recipeId,
      weightKg: unitsToWeight(so.quantity, product.weightG).kg,
      status,
      createdBy: 'u-supervisor',
      createdAt,
      ...extra,
    });
    buildRoute(product.type).forEach((type, i) => {
      const p = plan[type]!;
      stages.push({ id: stageId(id, type), orderId: id, type, sequence: i + 1, machineId: p.machineId, operatorIds: p.operatorIds, status: p.status });
    });
    return id;
  };

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(3, '0')}`;
  const punch = (stage: string, operatorId: string, machineId: string | undefined, start: string, end?: string, pauses: Pause[] = []) =>
    timeEntries.push({ id: nextId('te'), stageId: stage, operatorId, machineId, start, end, pauses });
  const produce = (stage: string, operatorId: string, machineId: string | undefined, when: string, data: Pick<ProductionRecord, 'rawMaterialKg' | 'rollKg' | 'units'>) =>
    productionRecords.push({ id: nextId('pr'), stageId: stage, operatorId, machineId, at: when, ...data });
  const waste = (stage: string, operatorId: string, kg: number, destination: WasteDestination, when: string) =>
    wasteRecords.push({ id: nextId('wr'), stageId: stage, operatorId, kg, destination, at: when });

  // OP-0001 · FV-1520 (vivero) · Cerrada. Waste 3,5 kg over 122 kg = 2,87 %.
  {
    const o = addOrder(1, 'ped-0001', 'r-fv1520-v1', 'closed', at(-25, 8), {
      extrusion: { machineId: 'mc-ext02', operatorIds: ['u-op1'], status: 'done' },
      sealing: { machineId: 'mc-sel02', operatorIds: ['u-op2'], status: 'done' },
      dieCutting: { machineId: 'mc-trq01', operatorIds: ['u-op4'], status: 'done' },
      packing: { operatorIds: ['u-op2'], status: 'done' },
    }, { finalCount: 20_080, bundles: 20, packedAt: at(-19, 15), closedBy: 'u-supervisor', closedAt: at(-18, 9) });
    punch(stageId(o, 'extrusion'), 'u-op1', 'mc-ext02', at(-24, 7), at(-24, 12), [
      { type: 'active', start: at(-24, 9), end: at(-24, 9, 10) },
      { type: 'rest', start: at(-24, 10), end: at(-24, 10, 20) },
    ]);
    produce(stageId(o, 'extrusion'), 'u-op1', 'mc-ext02', at(-24, 11, 55), { rawMaterialKg: 122, rollKg: 118.5 });
    waste(stageId(o, 'extrusion'), 'u-op1', 3.0, 'pelletized', at(-24, 11, 58));
    punch(stageId(o, 'sealing'), 'u-op2', 'mc-sel02', at(-23, 7), at(-23, 13), [
      { type: 'active', start: at(-23, 9), end: at(-23, 9, 10) },
      { type: 'rest', start: at(-23, 10, 30), end: at(-23, 11) },
    ]);
    produce(stageId(o, 'sealing'), 'u-op2', 'mc-sel02', at(-23, 12, 55), { units: 20_150 });
    punch(stageId(o, 'dieCutting'), 'u-op4', 'mc-trq01', at(-22, 8), at(-22, 11), [
      { type: 'active', start: at(-22, 9, 30), end: at(-22, 9, 40) },
    ]);
    produce(stageId(o, 'dieCutting'), 'u-op4', 'mc-trq01', at(-22, 10, 55), { units: 20_100 });
    waste(stageId(o, 'dieCutting'), 'u-op4', 0.5, 'ground', at(-22, 10, 58));
    punch(stageId(o, 'packing'), 'u-op2', undefined, at(-19, 13, 30), at(-19, 15));
  }

  // OP-0002 · FN-2030 · Servicio a terceros (cliente entrega 62 kg) · Cerrada.
  {
    const o = addOrder(2, 'ped-0002', 'r-fn2030-v1', 'closed', at(-15, 8), {
      extrusion: { machineId: 'mc-ext01', operatorIds: ['u-op3'], status: 'done' },
      sealing: { machineId: 'mc-sel01', operatorIds: ['u-op4'], status: 'done' },
      packing: { operatorIds: ['u-op2'], status: 'done' },
    }, { finalCount: 15_020, bundles: 15, packedAt: at(-11, 15), closedBy: 'u-supervisor', closedAt: at(-10, 9) });
    punch(stageId(o, 'extrusion'), 'u-op3', 'mc-ext01', at(-14, 7), at(-14, 10), [
      { type: 'active', start: at(-14, 8, 30), end: at(-14, 8, 40) },
    ]);
    produce(stageId(o, 'extrusion'), 'u-op3', 'mc-ext01', at(-14, 9, 55), { rawMaterialKg: 61, rollKg: 59.6 });
    waste(stageId(o, 'extrusion'), 'u-op3', 1.4, 'ground', at(-14, 9, 58));
    punch(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', at(-13, 7), at(-13, 11), [
      { type: 'rest', start: at(-13, 9), end: at(-13, 9, 20) },
    ]);
    produce(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', at(-13, 10, 55), { units: 15_050 });
    punch(stageId(o, 'packing'), 'u-op2', undefined, at(-11, 14), at(-11, 15));
  }

  // OP-0003 · FI-4060 (impresa) · Por validar (flow 5). Packed today by operario2.
  {
    const o = addOrder(3, 'ped-0003', 'r-fi4060-v2', 'toValidate', at(-6, 8), {
      extrusion: { machineId: 'mc-ext02', operatorIds: ['u-op1'], status: 'done' },
      printing: { machineId: 'mc-imp01', operatorIds: ['u-op3'], status: 'done' },
      sealing: { machineId: 'mc-sel01', operatorIds: ['u-op4'], status: 'done' },
      packing: { operatorIds: ['u-op2'], status: 'done' },
    }, { finalCount: 7_960, bundles: 8, packedAt: ago(120) });
    punch(stageId(o, 'extrusion'), 'u-op1', 'mc-ext02', at(-5, 7), at(-5, 11, 30), [
      { type: 'active', start: at(-5, 8, 30), end: at(-5, 8, 40) },
      { type: 'rest', start: at(-5, 10), end: at(-5, 10, 20) },
    ]);
    produce(stageId(o, 'extrusion'), 'u-op1', 'mc-ext02', at(-5, 11, 25), { rawMaterialKg: 102, rollKg: 99.2 });
    waste(stageId(o, 'extrusion'), 'u-op1', 2.4, 'pelletized', at(-5, 11, 28));
    punch(stageId(o, 'printing'), 'u-op3', 'mc-imp01', at(-4, 7), at(-4, 11), [
      { type: 'active', start: at(-4, 9), end: at(-4, 9, 10) },
    ]);
    produce(stageId(o, 'printing'), 'u-op3', 'mc-imp01', at(-4, 10, 55), { units: 8_100 });
    waste(stageId(o, 'printing'), 'u-op3', 0.4, 'sold', at(-4, 10, 58));
    punch(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', at(-3, 7), at(-3, 12), [
      { type: 'rest', start: at(-3, 9, 30), end: at(-3, 10) },
    ]);
    produce(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', at(-3, 11, 55), { units: 8_020 });
    punch(stageId(o, 'packing'), 'u-op2', undefined, ago(180), ago(120));
  }

  // OP-0004 · FN-2030 · En proceso. Waste 2,1 kg over 60 kg = 3,5 % -> alert (RF-17).
  // EXT-01 operating (operario3), SEL-01 in active pause (operario4).
  {
    const o = addOrder(4, 'ped-0004', 'r-fn2030-v1', 'inProgress', at(-3, 8), {
      extrusion: { machineId: 'mc-ext01', operatorIds: ['u-op1', 'u-op3'], status: 'inProgress' },
      sealing: { machineId: 'mc-sel01', operatorIds: ['u-op4'], status: 'inProgress' },
      packing: { operatorIds: ['u-op2'], status: 'pending' },
    });
    punch(stageId(o, 'extrusion'), 'u-op1', 'mc-ext01', ago(240), ago(90), [
      { type: 'active', start: ago(180), end: ago(170) },
      { type: 'rest', start: ago(135), end: ago(120) },
    ]);
    produce(stageId(o, 'extrusion'), 'u-op1', 'mc-ext01', ago(95), { rawMaterialKg: 60, rollKg: 57.9 });
    waste(stageId(o, 'extrusion'), 'u-op1', 2.1, 'ground', ago(92));
    punch(stageId(o, 'extrusion'), 'u-op3', 'mc-ext01', ago(60));
    punch(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', ago(50), undefined, [{ type: 'active', start: ago(5) }]);
    produce(stageId(o, 'sealing'), 'u-op4', 'mc-sel01', ago(10), { units: 6_200 });
  }

  // OP-0005 · FB-2636 · Pendiente, released to plant (visible in M-01 for operario1/2).
  addOrder(5, 'ped-0005', 'r-fb2636-v1', 'pending', at(-1, 11), {
    extrusion: { machineId: 'mc-ext02', operatorIds: ['u-op1'], status: 'pending' },
    sealing: { machineId: 'mc-sel02', operatorIds: ['u-op2'], status: 'pending' },
    packing: { operatorIds: ['u-op2'], status: 'pending' },
  });

  // ---- reference prices ----
  const proposal = (
    id: string, productId: string, baseUnitCost: number, margin: number,
    proposedAt: string, status: PriceProposal['status'], decidedAt?: string, extra: Partial<PriceProposal> = {},
  ): PriceProposal => {
    const method: MarginMethod = 'onCost';
    return {
      id, productId, baseUnitCost, margin, method,
      price: round4(baseUnitCost * (1 + margin)),
      status, proposedBy: 'u-ventas', proposedAt,
      decidedBy: decidedAt ? 'u-admin' : undefined, decidedAt,
      ...extra,
    };
  };
  const priceProposals: PriceProposal[] = [
    proposal('pp-01', 'p-fn2030', 0.0096, 0.25, inMonth(-4, 6, 9), 'approved', inMonth(-4, 6, 16)),
    proposal('pp-02', 'p-fi4060', 0.0352, 0.3, inMonth(-4, 6, 9), 'approved', inMonth(-4, 6, 16)),
    proposal('pp-03', 'p-fv1520', 0.014, 0.3, inMonth(-3, 12, 9), 'approved', inMonth(-3, 12, 15)),
    proposal('pp-04', 'p-fb2636', 0.0138, 0.2, inMonth(-2, 14, 9), 'approved', inMonth(-2, 14, 12)),
    proposal('pp-05', 'p-fn2030', 0.01, 0.25, inMonth(-1, 8, 9), 'approved', inMonth(-1, 8, 14)),
    proposal('pp-06', 'p-fi4060', 0.0365, 0.3, inMonth(-1, 8, 9), 'approved', inMonth(-1, 8, 14)),
    // Pending in W-17: one below the line minimum (15 % < 20 %), one normal.
    proposal('pp-07', 'p-fn2030', 0.0104, 0.15, at(-1, 10, 30), 'proposed', undefined, { quantity: 25_000 }),
    proposal('pp-08', 'p-fv1520', 0.0146, 0.3, at(-2, 15), 'proposed', undefined, { quantity: 30_000 }),
  ];

  // ---- quotes (flow 3). COT-0102 has its FN-2030 line at 15 % waiting for authorization (W-01, W-09). ----
  const quotes: Quote[] = [
    {
      id: 'cot-0102', code: 'COT-0102', customerId: 'c-comercial', revision: 1, status: 'pendingAuthorization',
      lines: [
        { id: 'cot-0102-1', productId: 'p-fi4060', quantity: 10_000, materials: 205.28, transformation: 166.15, marginPct: 0.25 },
        { id: 'cot-0102-2', productId: 'p-fn2030', quantity: 50_000, materials: 296.4, transformation: 220.75, marginPct: 0.15 },
      ],
      exception: {
        lineId: 'cot-0102-2', marginPct: 0.15, minMargin: 0.2,
        reason: 'Cliente recurrente; 50.000 fundas con dos entregas programadas.',
        requestedBy: 'u-ventas', requestedAt: ago(60), status: 'pending',
      },
      createdBy: 'u-ventas', createdAt: ago(75),
    },
    {
      id: 'cot-0097', code: 'COT-0097', customerId: 'c-agricola', revision: 1, status: 'confirmed',
      lines: [{ id: 'cot-0097-1', productId: 'p-fv1520', quantity: 25_000, materials: 190.5, transformation: 164.5, marginPct: 0.23 }],
      createdBy: 'u-ventas', createdAt: at(-9, 10),
    },
    {
      id: 'cot-0098', code: 'COT-0098', customerId: 'c-distribuidora', revision: 1, status: 'authorized',
      lines: [{ id: 'cot-0098-1', productId: 'p-fb2636', quantity: 30_000, materials: 168.6, transformation: 192.9, marginPct: 0.18 }],
      exception: {
        lineId: 'cot-0098-1', marginPct: 0.18, minMargin: 0.2,
        reason: 'Pedido de prueba de un cliente nuevo.',
        requestedBy: 'u-ventas', requestedAt: at(-7, 10), status: 'authorized',
        decidedBy: 'u-admin', decidedAt: at(-7, 12), observation: 'Autorizado una sola vez.',
      },
      createdBy: 'u-ventas', createdAt: at(-7, 9),
    },
  ];

  // ---- monthly history for trend charts (W-01, W-15, W-19) ----
  // FI-4060 went from 0,0349 to 0,0371 USD per bag in 6 months (+6,3 %), by the resin price.
  const unitCostSeries: Record<string, number[]> = {
    'p-fn2030': [0.0094, 0.0096, 0.0098, 0.01, 0.0102, 0.0103],
    'p-fi4060': [0.0349, 0.0352, 0.0358, 0.0356, 0.0363, 0.0371],
    'p-fv1520': [0.0136, 0.0138, 0.014, 0.0142, 0.0144, 0.0142],
    'p-fb2636': [0.0131, 0.0133, 0.0135, 0.0136, 0.0138, 0.014],
  };
  const monthlyUnitCosts: MonthlyUnitCost[] = Object.entries(unitCostSeries).flatMap(([productId, values]) =>
    values.map((unitCost, i) => ({ month: monthKey(SIX_MONTHS[i]), productId, unitCost })),
  );

  // Last month: extrusion over the 3,0 % threshold; plant average 2,7 % (W-01, W-18).
  const wasteSeries: Record<MonthlyWaste['section'], number[]> = {
    extrusion: [0.028, 0.026, 0.029, 0.027, 0.032, 0.029],
    printing: [0.012, 0.011, 0.013, 0.012, 0.014, 0.01],
    sealing: [0.009, 0.01, 0.008, 0.009, 0.008, 0.007],
    dieCutting: [0.006, 0.007, 0.006, 0.008, 0.005, 0.004],
    packing: [0.003, 0.003, 0.004, 0.003, 0.003, 0.002],
    all: [0.026, 0.025, 0.028, 0.026, 0.027, 0.025],
  };
  const monthlyWaste: MonthlyWaste[] = (Object.keys(wasteSeries) as MonthlyWaste['section'][]).flatMap((section) =>
    wasteSeries[section].map((wastePct, i) => ({ month: monthKey(SIX_MONTHS[i]), section, wastePct })),
  );

  // ---- audit log (RF-04), oldest first ----
  let auditSeq = 0;
  const audit = (when: string, userId: string, entity: string, entityId: string, action: string, before?: string, after?: string): AuditEntry =>
    ({ id: `au-${String(++auditSeq).padStart(3, '0')}`, at: when, userId, entity, entityId, action, before, after });
  const auditLog: AuditEntry[] = [
    audit(inMonth(-8, 1, 8), 'u-admin', 'Tarifa', 'Indirectos', 'Modificó', '2,25 USD/h', '2,40 USD/h'),
    audit(inMonth(-8, 1, 8), 'u-admin', 'Regla', 'Ganancia mínima', 'Modificó', '18 %', '20 %'),
    audit(inMonth(-1, 15, 16), 'u-admin', 'Exportación', 'CSV', 'Exportó', undefined, '4 productos'),
    audit(at(-4, 15, 2), 'u-admin', 'Cuenta', 'operario3', 'Desactivó', 'Activa', 'Inactiva'),
    audit(at(-1, 16, 20), 'u-admin', 'Tarifa', 'Op. extrusión', 'Modificó', '2,95 USD/h', '3,10 USD/h'),
    audit(at(-1, 17, 5), 'u-admin', 'Precio', 'PEBD · Plásticos del Litoral', 'Registró', '1,50 USD/kg', '1,58 USD/kg'),
    audit(ago(60), 'u-ventas', 'Cotización', 'COT-0102', 'Envió a autorización', undefined, 'FN-2030 al 15 % (excepción)'),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const dobraExports: Database['dobraExports'] = [
    {
      id: 'dx-01',
      at: inMonth(-1, 9, 10),
      userId: 'u-admin',
      fileName: `costos_precios_${monthKey(-1).replace('-', '')}15.csv`,
      productIds: ['p-fn2030', 'p-fi4060', 'p-fv1520', 'p-fb2636'],
    },
  ];

  return {
    users,
    positions,
    positionRates,
    materials,
    suppliers,
    supplierPrices,
    referencePrices,
    productLines,
    products,
    recipes,
    customers,
    salesOrders,
    machines,
    machineRates,
    indirectRates,
    ruleRates,
    quotes,
    stageStandards,
    orders,
    stages,
    productionRecords,
    wasteRecords,
    timeEntries,
    orderCosts: [], // snapshots of closed orders are computed with costing.ts when the store loads
    priceProposals,
    auditLog,
    dobraExports,
    notifications: [],
    monthlyUnitCosts,
    monthlyWaste,
    settings: {
      minMargin: 0.2,
      balanceTolerance: 0.005,
      maxWastePct: 0.03,
      localImportThreshold: 0.1,
      marginMethod: 'onCost',
      wasteRecoveryPerKg: { ground: 0.45, pelletized: 0.6, sold: 0.25 },
    },
  };
}
