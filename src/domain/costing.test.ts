import { createSeed } from '@/data/seed';
import {
  computeOrderCost,
  currentRecipe,
  laborCost,
  machineCost,
  materialCost,
  orderCost,
  recalcStandardCosts,
  standardCost,
} from './costing';
import type { Database } from './types';

const NOW = new Date(2026, 10, 2, 11, 0); // 2 nov 2026, 11:00 local
const fresh = (): Database => createSeed(NOW);

describe('formulas (RF-31 to RF-33)', () => {
  it('materialCost sums consumption × price, rounded to 2 decimals', () => {
    expect(materialCost([{ quantity: 100, price: 1.5 }, { quantity: 1.2, price: 9.8 }])).toBe(161.76);
  });
  it('materialCost is 0 for a third-party service', () => {
    expect(materialCost([{ quantity: 100, price: 1.5 }], true)).toBe(0);
  });
  it('2 h × 3,00 USD/h -> 6,00 USD (labor and machine)', () => {
    expect(laborCost([{ hours: 2, rate: 3 }])).toBe(6);
    expect(machineCost([{ hours: 2, rate: 3 }])).toBe(6);
  });
  it('CT 200,00 and 10.000 units -> CU 0,0200', () => {
    expect(orderCost({ materials: 150, labor: 30, machine: 25, recovered: 5, units: 10_000 })).toEqual({ total: 200, unitCost: 0.02 });
  });
  it('unit cost is 0 when nothing was counted', () => {
    expect(orderCost({ materials: 10, labor: 0, machine: 0, recovered: 0, units: 0 }).unitCost).toBe(0);
  });
});

describe('computeOrderCost', () => {
  const db = fresh();
  const op1 = db.orders.find((o) => o.code === 'OP-0001')!;
  const cost = computeOrderCost(db, op1.id, op1.closedAt!);

  it('costs materials from raw material used × recipe × price in force at closing', () => {
    // 122 kg × (0,60 × 1,48 PEBD + 0,35 × 0,60 REC + 0,05 × 3,15 PIG-N), October prices
    expect(cost.materials).toBe(153.17);
    expect(cost.lines.filter((l) => l.kind === 'material').map((l) => l.refId)).toEqual(['m-pebd', 'm-rec', 'm-pign']);
  });

  it('labor counts effective hours only (pauses excluded)', () => {
    // Hugo 4,5 h × 3,25 + Iván (5 h 20 min + 1 h 30 min) × 3,00 + Kevin 2 h 50 min × 3,00
    expect(cost.labor).toBe(43.63);
    expect(cost.lines.find((l) => l.kind === 'labor' && l.refId === 'u-op1')!.quantity).toBeCloseTo(4.5, 6);
  });

  it('machine cost uses the hourly cost of each machine', () => {
    // EXT-02 4,5 h × 8,50 + SEL-02 5,33 h × 5,00 + TRQ-01 2,83 h × 4,00
    expect(cost.machine).toBe(76.25);
  });

  it('subtracts recovered waste and the breakdown adds up to the total', () => {
    expect(cost.recovered).toBeGreaterThan(0);
    expect(cost.total).toBeCloseTo(cost.materials + cost.labor + cost.machine - cost.recovered, 10);
    expect(cost.units).toBe(20_080);
    expect(cost.unitCost).toBe(Math.round((cost.total / 20_080) * 10_000) / 10_000);
  });

  it('third-party service has CM = 0 and no recovered value (RF-35)', () => {
    const op2 = db.orders.find((o) => o.code === 'OP-0002')!;
    const service = computeOrderCost(db, op2.id, op2.closedAt!);
    expect(service.isService).toBe(true);
    expect(service.materials).toBe(0);
    expect(service.recovered).toBe(0);
    expect(service.lines.some((l) => l.kind === 'material')).toBe(false);
    expect(service.labor + service.machine).toBeGreaterThan(0);
  });

  it('a later price change does not alter the cost of a closed order (RF-34)', () => {
    const changed = fresh();
    changed.supplierPrices.push({ id: 'sp-new', materialId: 'm-pebd', supplierId: 's-polimeros', price: 2.5, validFrom: '2026-11-02', createdBy: 'u-contabilidad' });
    expect(computeOrderCost(changed, op1.id, op1.closedAt!)).toEqual(cost);
  });

  it('fails for an unknown order', () => {
    expect(() => computeOrderCost(db, 'op-x', op1.closedAt!)).toThrow('Orden no encontrada');
  });
});

describe('standard cost and recalculation (RF-34)', () => {
  const db = fresh();
  const at = NOW.toISOString();

  it('uses the latest approved recipe version', () => {
    expect(currentRecipe(db, 'p-fi4060').version).toBe(2);
    expect(currentRecipe(db, 'p-fb2636').status).toBe('approved'); // v2 is still a draft
  });

  it('FN-2030: (material 1,518 + conversion 0,9167 USD/kg) × 4 g = 0,0097', () => {
    const std = standardCost(db, 'p-fn2030', at);
    expect(std.materialPerKg).toBe(1.518);
    expect(std.conversionPerKg).toBe(0.9167);
    expect(std.unitCost).toBe(0.0097);
  });

  it('only recalculates products whose approved recipe uses the material', () => {
    expect(recalcStandardCosts(db, { materialId: 'm-tinta', oldPrice: 9.8, newPrice: 10.5 }, at).map((r) => r.productId)).toEqual(['p-fi4060']);
    expect(recalcStandardCosts(db, { materialId: 'm-pead', oldPrice: 1.62, newPrice: 1.7 }, at).map((r) => r.productId)).toEqual(['p-fn2030', 'p-fi4060']);
  });

  it('reports before, after and variation', () => {
    const [fi] = recalcStandardCosts(db, { materialId: 'm-tinta', oldPrice: 9.8, newPrice: 19.6 }, at);
    expect(fi.after).toBeGreaterThan(fi.before);
    expect(fi.variation).toBeCloseTo((fi.after - fi.before) / fi.before, 10);
  });

  it('price override does not modify the stored prices', () => {
    const before = db.supplierPrices.length;
    recalcStandardCosts(db, { materialId: 'm-pebd', oldPrice: 1.5, newPrice: 1.6 }, at);
    expect(db.supplierPrices).toHaveLength(before);
  });
});
