import { unitsToWeight } from '@/domain/conversion';
import { buildRoute, sectionOf } from '@/domain/routing';
import type { Database, Role } from '@/domain/types';
import { createSeed, DEMO_PASSWORD, QUICK_ACCESS_USERNAMES } from './seed';

const NOW = new Date(2026, 10, 2, 11, 0); // 2 nov 2026, 11:00 local
const db: Database = createSeed(NOW);

const byCode = <T extends { code: string }>(list: T[], code: string) => list.find((x) => x.code === code)!;

/** Price in force today for a material/supplier: most recent validFrom. */
function currentPrice(materialCode: string, supplierId: string) {
  const material = byCode(db.materials, materialCode);
  return db.supplierPrices
    .filter((p) => p.materialId === material.id && p.supplierId === supplierId)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

describe('demo users', () => {
  it('has one active quick-access user per role, all with the demo password', () => {
    const quick = QUICK_ACCESS_USERNAMES.map((u) => db.users.find((x) => x.username === u)!);
    expect(quick.every((u) => u.active && u.password === DEMO_PASSWORD)).toBe(true);
    const roles = new Set(quick.map((u) => u.role));
    expect(roles).toEqual(new Set<Role>(['adm', 'ven', 'con', 'fac', 'rrhh', 'sup', 'ope']));
  });

  it('operators have a position for labor cost', () => {
    expect(db.users.filter((u) => u.role === 'ope').every((u) => u.positionId)).toBe(true);
  });
});

describe('catalog matches AGENTS.md section 8', () => {
  it('products have the specified weights and types', () => {
    expect(byCode(db.products, 'FN-2030')).toMatchObject({ weightG: 4, type: 'natural', gauge: 1.5 });
    expect(byCode(db.products, 'FI-4060')).toMatchObject({ weightG: 12.5, type: 'printed', gauge: 2 });
    expect(byCode(db.products, 'FV-1520')).toMatchObject({ weightG: 6, type: 'nursery', gauge: 2.5 });
    expect(byCode(db.products, 'FB-2636')).toMatchObject({ weightG: 8, type: 'natural', gauge: 1.2 });
  });

  it('current supplier prices', () => {
    expect(currentPrice('PEBD', 's-polimeros').price).toBe(1.5);
    expect(currentPrice('PEBD', 's-global')).toMatchObject({ price: 1.4, leadTimeDays: 35 });
    expect(currentPrice('PEAD', 's-polimeros').price).toBe(1.62);
    expect(currentPrice('PEAD', 's-global')).toMatchObject({ price: 1.45, leadTimeDays: 40 });
    expect(currentPrice('REC', 's-propio').price).toBe(0.6);
    expect(currentPrice('PIG-N', 's-colorantes').price).toBe(3.2);
    expect(currentPrice('TINTA', 's-tintas').price).toBe(9.8);
  });

  it('imported prices always have a lead time (RF-26)', () => {
    const imported = new Set(db.suppliers.filter((s) => s.origin === 'imported').map((s) => s.id));
    const prices = db.supplierPrices.filter((p) => imported.has(p.supplierId));
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((p) => (p.leadTimeDays ?? 0) > 0)).toBe(true);
  });

  it('current machine rates', () => {
    const rate = (code: string) => {
      const m = byCode(db.machines, code);
      return db.machineRates.filter((r) => r.machineId === m.id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0].hourlyCost;
    };
    expect([rate('EXT-01'), rate('EXT-02'), rate('IMP-01'), rate('SEL-01'), rate('SEL-02'), rate('TRQ-01')]).toEqual([8.5, 8.5, 10, 5, 5, 4]);
  });

  it('every product has an approved recipe and there is a draft for W-06', () => {
    for (const p of db.products) {
      expect(db.recipes.some((r) => r.productId === p.id && r.status === 'approved')).toBe(true);
    }
    expect(db.recipes.filter((r) => r.status === 'draft')).toHaveLength(1);
  });
});

describe('prepared cases', () => {
  it('pending order of 10.000 FI-4060 for Comercial Ejemplo converts to 125 kg / 275,58 lb', () => {
    const product = byCode(db.products, 'FI-4060');
    const so = db.salesOrders.find((s) => s.productId === product.id && s.status === 'pending' && s.quantity === 10_000)!;
    expect(db.customers.find((c) => c.id === so.customerId)!.name).toBe('Comercial Ejemplo S.A.');
    expect(unitsToWeight(so.quantity, product.weightG)).toEqual({ kg: 125, lb: 275.58 });
  });

  it('FN-2030 order in progress has 3,5 % waste over raw material used', () => {
    const product = byCode(db.products, 'FN-2030');
    const order = db.orders.find((o) => {
      const so = db.salesOrders.find((s) => s.id === o.salesOrderId)!;
      return so.productId === product.id && o.status === 'inProgress';
    })!;
    const stageIds = new Set(db.stages.filter((s) => s.orderId === order.id).map((s) => s.id));
    const raw = db.productionRecords.filter((r) => stageIds.has(r.stageId)).reduce((t, r) => t + (r.rawMaterialKg ?? 0), 0);
    const waste = db.wasteRecords.filter((w) => stageIds.has(w.stageId)).reduce((t, w) => t + w.kg, 0);
    expect(waste / raw).toBeCloseTo(0.035, 6);
  });

  it('other orders stay under the 3 % waste threshold', () => {
    for (const order of db.orders.filter((o) => o.status !== 'inProgress')) {
      const stageIds = new Set(db.stages.filter((s) => s.orderId === order.id).map((s) => s.id));
      const raw = db.productionRecords.filter((r) => stageIds.has(r.stageId)).reduce((t, r) => t + (r.rawMaterialKg ?? 0), 0);
      const waste = db.wasteRecords.filter((w) => stageIds.has(w.stageId)).reduce((t, w) => t + w.kg, 0);
      if (raw > 0) expect(waste / raw).toBeLessThanOrEqual(db.settings.maxWastePct);
    }
  });

  it('orders cover pending, in progress, to validate and closed, including a third-party service', () => {
    expect(new Set(db.orders.map((o) => o.status))).toEqual(new Set(['pending', 'inProgress', 'toValidate', 'closed']));
    const closedService = db.orders.find((o) => o.status === 'closed' && db.salesOrders.find((s) => s.id === o.salesOrderId)!.isService);
    expect(closedService).toBeDefined();
  });

  it('a pending price proposal is below its line minimum (W-17)', () => {
    const below = db.priceProposals.filter((p) => {
      const product = db.products.find((x) => x.id === p.productId)!;
      const line = db.productLines.find((l) => l.id === product.lineId)!;
      return p.status === 'proposed' && p.margin < line.minMargin;
    });
    expect(below).toHaveLength(1);
    expect(below[0].margin).toBe(0.15);
  });

  it('has 6 months of unit cost and waste history', () => {
    expect(new Set(db.monthlyUnitCosts.map((m) => m.month)).size).toBe(6);
    expect(new Set(db.monthlyWaste.map((m) => m.month)).size).toBe(6);
    expect(db.monthlyUnitCosts.at(-1)!.month).toBe('2026-11');
  });

  it('PEBD has a price for each of the last 6 months', () => {
    const pebd = byCode(db.materials, 'PEBD');
    const months = new Set(db.supplierPrices.filter((p) => p.materialId === pebd.id).map((p) => p.validFrom.slice(0, 7)));
    expect(months).toEqual(new Set(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']));
  });
});

describe('referential integrity', () => {
  const ids = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id));
  const users = ids(db.users);
  const machines = ids(db.machines);
  const stages = ids(db.stages);

  it('orders follow the route of their product type and their stages are fully assigned', () => {
    for (const order of db.orders) {
      const so = db.salesOrders.find((s) => s.id === order.salesOrderId)!;
      const product = db.products.find((p) => p.id === so.productId)!;
      const recipe = db.recipes.find((r) => r.id === order.recipeId)!;
      expect(recipe).toMatchObject({ productId: product.id, status: 'approved' });
      expect(order.weightKg).toBe(unitsToWeight(so.quantity, product.weightG).kg);

      const orderStages = db.stages.filter((s) => s.orderId === order.id).sort((a, b) => a.sequence - b.sequence);
      expect(orderStages.map((s) => s.type)).toEqual(buildRoute(product.type));
      for (const stage of orderStages) {
        expect(stage.operatorIds.length).toBeGreaterThan(0);
        expect(stage.operatorIds.every((u) => users.has(u))).toBe(true);
        const section = sectionOf(stage.type);
        if (section) {
          expect(db.machines.find((m) => m.id === stage.machineId)!.section).toBe(section);
        } else {
          expect(stage.machineId).toBeUndefined();
        }
      }
    }
  });

  it('records point to existing stages, operators and machines', () => {
    for (const r of [...db.productionRecords, ...db.timeEntries]) {
      expect(stages.has(r.stageId)).toBe(true);
      expect(users.has(r.operatorId)).toBe(true);
      if (r.machineId) expect(machines.has(r.machineId)).toBe(true);
    }
    for (const w of db.wasteRecords) expect(stages.has(w.stageId)).toBe(true);
  });

  it('time entries belong to an operator assigned to the stage', () => {
    for (const t of db.timeEntries) {
      expect(db.stages.find((s) => s.id === t.stageId)!.operatorIds).toContain(t.operatorId);
    }
  });

  it('each operator has at most one running timer (RF-21)', () => {
    const running = db.timeEntries.filter((t) => !t.end).map((t) => t.operatorId);
    expect(new Set(running).size).toBe(running.length);
  });

  it('time entries and pauses never end before they start, nor in the future', () => {
    for (const t of db.timeEntries) {
      if (t.end) expect(t.end >= t.start).toBe(true);
      expect(t.start <= NOW.toISOString()).toBe(true);
      for (const p of t.pauses) {
        expect(p.start >= t.start).toBe(true);
        if (p.end) expect(p.end >= p.start).toBe(true);
        if (t.end && p.end) expect(p.end <= t.end).toBe(true);
      }
    }
  });

  it('IDs are unique within each collection', () => {
    const collections: { id: string }[][] = [db.users, db.materials, db.supplierPrices, db.products, db.recipes, db.salesOrders, db.orders, db.stages,
      db.productionRecords, db.wasteRecords, db.timeEntries, db.priceProposals, db.auditLog, db.positionRates, db.machineRates];
    for (const c of collections) expect(ids(c).size).toBe(c.length);
  });

  it('usernames are unique', () => {
    expect(new Set(db.users.map((u) => u.username)).size).toBe(db.users.length);
  });
});
