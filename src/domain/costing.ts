// Production costing engine (RF-31 to RF-35). Totals rounded to 2 decimals, unit values to 4 (RNF-20).
import { rateAt, referencePrice } from './prices';
import { orderStageIds, timeBreakdown } from './production';
import { round2, round4 } from './rounding';
import { buildRoute, sectionOf } from './routing';
import type { Database, OrderCost, OrderCostLine } from './types';

const HOUR_MS = 3_600_000;

// ---- formulas ----

/** CM = Σ consumption × price in force; 0 for third-party services (RF-31, RF-35). */
export function materialCost(consumptions: { quantity: number; price: number }[], isService = false): number {
  if (isService) return 0;
  return round2(consumptions.reduce((t, c) => t + c.quantity * c.price, 0));
}

/** CMO = Σ effective hours × position hourly cost (RF-32). */
export function laborCost(items: { hours: number; rate: number }[]): number {
  return round2(items.reduce((t, i) => t + i.hours * i.rate, 0));
}

/** CMQ = Σ machine hours × machine hourly cost (RF-32). */
export function machineCost(items: { hours: number; rate: number }[]): number {
  return round2(items.reduce((t, i) => t + i.hours * i.rate, 0));
}

/** CT = CM + CMO + CMQ − VR; CU = CT / counted units (RF-33). The breakdown adds up exactly to CT. */
export function orderCost(parts: { materials: number; labor: number; machine: number; recovered: number; units: number }) {
  const total = round2(round2(parts.materials) + round2(parts.labor) + round2(parts.machine) - round2(parts.recovered));
  const unitCost = parts.units > 0 ? round4(total / parts.units) : 0;
  return { total, unitCost };
}

// ---- order costing from recorded data ----

function addLine(lines: OrderCostLine[], kind: OrderCostLine['kind'], refId: string, quantity: number, rate: number) {
  const existing = lines.find((l) => l.kind === kind && l.refId === refId && l.rate === rate);
  if (existing) {
    existing.quantity += quantity;
    existing.amount = round2(existing.quantity * rate);
  } else {
    lines.push({ kind, refId, quantity, rate, amount: round2(quantity * rate) });
  }
}

/**
 * Costs an order from its records with the prices and rates in force at `at` (validation time).
 * Labor uses effective time only; machines run while the operator is not paused.
 * Third-party services carry no material cost and no recovered value (the material is the customer's).
 */
export function computeOrderCost(db: Database, orderId: string, at: string): OrderCost {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
  const salesOrder = db.salesOrders.find((s) => s.id === order.salesOrderId)!;
  const recipe = db.recipes.find((r) => r.id === order.recipeId)!;
  const isService = salesOrder.isService;
  const stageIds = orderStageIds(db, orderId);
  const lines: OrderCostLine[] = [];

  if (!isService) {
    const rawKg = db.productionRecords.filter((r) => stageIds.has(r.stageId)).reduce((t, r) => t + (r.rawMaterialKg ?? 0), 0);
    for (const item of recipe.items) {
      addLine(lines, 'material', item.materialId, rawKg * item.qtyPerKg, referencePrice(db.supplierPrices, db.suppliers, item.materialId, at));
    }
  }

  for (const entry of db.timeEntries.filter((t) => stageIds.has(t.stageId))) {
    const hours = timeBreakdown(entry, new Date(at)).effectiveMs / HOUR_MS;
    const operator = db.users.find((u) => u.id === entry.operatorId);
    const laborRate = rateAt(db.positionRates, (r) => r.positionId === operator?.positionId, entry.start);
    addLine(lines, 'labor', entry.operatorId, hours, laborRate);
    if (entry.machineId) {
      const machineRate = rateAt(db.machineRates, (r) => r.machineId === entry.machineId, entry.start);
      addLine(lines, 'machine', entry.machineId, hours, machineRate);
    }
  }

  if (!isService) {
    for (const waste of db.wasteRecords.filter((w) => stageIds.has(w.stageId))) {
      addLine(lines, 'recovery', waste.destination, waste.kg, db.settings.wasteRecoveryPerKg[waste.destination]);
    }
  }

  const of = (kind: OrderCostLine['kind']) => lines.filter((l) => l.kind === kind);
  const materials = materialCost(of('material').map((l) => ({ quantity: l.quantity, price: l.rate })), isService);
  const labor = laborCost(of('labor').map((l) => ({ hours: l.quantity, rate: l.rate })));
  const machine = machineCost(of('machine').map((l) => ({ hours: l.quantity, rate: l.rate })));
  const recovered = round2(of('recovery').reduce((t, l) => t + l.quantity * l.rate, 0));
  const units = order.finalCount ?? 0;
  const { total, unitCost } = orderCost({ materials, labor, machine, recovered, units });

  return { orderId, materials, labor, machine, recovered, total, unitCost, units, isService, lines, computedAt: at };
}

// ---- standard cost ----

export interface StandardCost {
  materialPerKg: number;
  conversionPerKg: number;
  unitCost: number; // USD per bag, 4 decimals
}

export interface PriceOverride {
  materialId: string;
  price: number;
}

/** Latest approved recipe of a product (the one orders must use, RF-08). */
export function currentRecipe(db: Database, productId: string) {
  return db.recipes
    .filter((r) => r.productId === productId && r.status === 'approved')
    .sort((a, b) => b.version - a.version)[0];
}

/**
 * Standard unit cost of a product: (recipe material cost per kg + conversion cost per kg) × weight.
 * Conversion per kg = Σ route stages (position rate + average machine rate of the section) / standard kg per hour.
 */
export function standardCost(db: Database, productId: string, at: string, override?: PriceOverride): StandardCost {
  const product = db.products.find((p) => p.id === productId)!;
  const recipe = currentRecipe(db, productId);
  const price = (materialId: string) =>
    override?.materialId === materialId ? override.price : referencePrice(db.supplierPrices, db.suppliers, materialId, at);
  const materialPerKg = recipe ? recipe.items.reduce((t, i) => t + i.qtyPerKg * price(i.materialId), 0) : 0;

  let conversionPerKg = 0;
  for (const stage of buildRoute(product.type)) {
    const std = db.stageStandards.find((s) => s.stage === stage);
    if (!std) continue;
    const labor = rateAt(db.positionRates, (r) => r.positionId === std.positionId, at);
    const section = sectionOf(stage);
    const machines = section ? db.machines.filter((m) => m.section === section && m.active) : [];
    const machine = machines.length
      ? machines.reduce((t, m) => t + rateAt(db.machineRates, (r) => r.machineId === m.id, at), 0) / machines.length
      : 0;
    conversionPerKg += (labor + machine) / std.kgPerHour;
  }

  return {
    materialPerKg: round4(materialPerKg),
    conversionPerKg: round4(conversionPerKg),
    unitCost: round4(((materialPerKg + conversionPerKg) * product.weightG) / 1000),
  };
}

export interface StandardCostImpact {
  productId: string;
  before: number;
  after: number;
  variation: number; // fraction
}

/**
 * Recalculates standard costs after a material price change (RF-34). Only products whose approved
 * recipe uses the material are listed; closed orders keep their stored snapshot (OrderCost).
 */
export function recalcStandardCosts(db: Database, change: { materialId: string; oldPrice: number; newPrice: number }, at: string): StandardCostImpact[] {
  return db.products
    .filter((p) => currentRecipe(db, p.id)?.items.some((i) => i.materialId === change.materialId))
    .map((p) => {
      const before = standardCost(db, p.id, at, { materialId: change.materialId, price: change.oldPrice }).unitCost;
      const after = standardCost(db, p.id, at, { materialId: change.materialId, price: change.newPrice }).unitCost;
      return { productId: p.id, before, after, variation: before > 0 ? (after - before) / before : 0 };
    });
}
