import { createSeed } from '@/data/seed';
import { inForce, quotesFor, referencePrice } from './prices';
import { belowMinimum, currentReferencePrice, priceFromMargin, profit, suggestPurchase } from './pricing';
import { canTransition, countDifference, effectiveTime, isWasteAlert, machineStatus, orderWaste, timeBreakdown, wastePercent } from './production';
import { timeReport } from './reports';
import type { TimeEntry } from './types';

const NOW = new Date(2026, 10, 2, 11, 0);
const db = createSeed(NOW);

describe('pricing (RF-36, RF-37)', () => {
  it('0,0200 al 25 % -> 0,0250 sobre costo / 0,0267 sobre precio', () => {
    expect(priceFromMargin(0.02, 0.25, 'onCost')).toBe(0.025);
    expect(priceFromMargin(0.02, 0.25, 'onPrice')).toBe(0.0267);
    expect(priceFromMargin(0.02, 1, 'onPrice')).toBeNaN();
  });
  it('15 % con mínimo 20 % -> bajo el mínimo', () => {
    expect(belowMinimum(0.15, 0.2)).toBe(true);
    expect(belowMinimum(0.2, 0.2)).toBe(false);
  });
  it('profit per unit and per order', () => {
    expect(profit(0.025, 0.02, 10_000)).toEqual({ perUnit: 0.005, perOrder: 50 });
  });
  it('current reference price is the latest approved proposal', () => {
    expect(currentReferencePrice(db.priceProposals, 'p-fn2030')!.price).toBe(0.0125);
    expect(currentReferencePrice(db.priceProposals, 'p-x')).toBeUndefined();
  });
});

describe('suggestPurchase (RF-28)', () => {
  it('1,50 vs 1,40 -> 6,7 % < 10 % -> comprar local', () => {
    const r = suggestPurchase(1.5, 1.4, 0.1);
    expect(r.difference).toBeCloseTo(0.0667, 4);
    expect(r.suggestion).toBe('local');
  });
  it('lowering the threshold switches the suggestion', () => {
    expect(suggestPurchase(1.5, 1.4, 0.05).suggestion).toBe('import');
  });
  it('imported more expensive -> local', () => {
    expect(suggestPurchase(1.4, 1.5, 0.1).suggestion).toBe('local');
  });
});

describe('order lifecycle (RF-20)', () => {
  it('allows the transitions of Figure 5.1', () => {
    expect(canTransition('pending', 'inProgress')).toBe(true);
    expect(canTransition('inProgress', 'toValidate')).toBe(true);
    expect(canTransition('toValidate', 'closed')).toBe(true);
    expect(canTransition('toValidate', 'inProgress')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });
  it('rejects the rest', () => {
    expect(canTransition('closed', 'inProgress')).toBe(false);
    expect(canTransition('inProgress', 'closed')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
  });
});

describe('waste (RF-16, RF-17)', () => {
  it('3,5 % -> alerta; 2,9 % -> sin alerta', () => {
    expect(isWasteAlert(wastePercent(3.5, 100), 0.03)).toBe(true);
    expect(isWasteAlert(wastePercent(2.9, 100), 0.03)).toBe(false);
    expect(wastePercent(1, 0)).toBe(0);
  });
  it('the FN-2030 order in progress raises the alert', () => {
    expect(orderWaste(db, 'op-0004')).toMatchObject({ rawKg: 60, wasteKg: 2.1, alert: true });
    expect(orderWaste(db, 'op-0003').alert).toBe(false);
  });
});

describe('countDifference (RF-18)', () => {
  it('10.000 pedidas y 9.950 contadas -> faltan 50', () => {
    expect(countDifference(10_000, 9_950)).toEqual({ kind: 'short', amount: 50 });
    expect(countDifference(10_000, 10_010)).toEqual({ kind: 'over', amount: 10 });
    expect(countDifference(10_000, 10_000)).toEqual({ kind: 'exact', amount: 0 });
  });
});

describe('time (RF-23)', () => {
  it('60 min con 10 min de pausa -> 50 min', () => {
    expect(effectiveTime(60, 10)).toBe(50);
  });
  it('splits active pauses and rests, measuring open pauses up to now', () => {
    const entry: TimeEntry = {
      id: 't', stageId: 's', operatorId: 'o', start: '2026-11-02T10:00:00Z',
      pauses: [
        { type: 'active', start: '2026-11-02T10:10:00Z', end: '2026-11-02T10:20:00Z' },
        { type: 'rest', start: '2026-11-02T10:50:00Z' },
      ],
    };
    const b = timeBreakdown(entry, new Date('2026-11-02T11:00:00Z'));
    expect(b).toEqual({ totalMs: 3_600_000, activePauseMs: 600_000, restMs: 600_000, effectiveMs: 2_400_000 });
  });
});

describe('timeReport (RF-40)', () => {
  it('report totals match the recorded time entries', () => {
    const { rows, total } = timeReport(db, {}, NOW);
    const sum = (k: 'effectiveMs' | 'activePauseMs' | 'restMs' | 'totalMs') => rows.reduce((t, r) => t + r[k], 0);
    expect(sum('effectiveMs')).toBe(total.effectiveMs);
    expect(total.effectiveMs + total.activePauseMs + total.restMs).toBe(total.totalMs);
    expect(total.entries).toBe(db.timeEntries.length);
  });
  it('filters by operator, machine and dates', () => {
    expect(timeReport(db, { operatorId: 'u-op1' }, NOW).rows.map((r) => r.operatorId)).toEqual(['u-op1']);
    const ext02 = timeReport(db, { machineId: 'mc-ext02' }, NOW).total;
    expect(ext02.machineMs).toBe(ext02.effectiveMs);
    expect(timeReport(db, { from: '2030-01-01' }, NOW).total.entries).toBe(0);
  });
  it('Hugo on OP-0001 extrusion: 5 h with 30 min of pauses -> 4,5 h effective, 90 %', () => {
    const r = timeReport(db, { operatorId: 'u-op1', machineId: 'mc-ext02', to: '2026-10-20' }, NOW).total;
    expect(r.effectiveMs).toBe(4.5 * 3_600_000);
    expect(r.effectiveShare).toBeCloseTo(0.9, 10);
  });
});

describe('plant monitor (RF-25)', () => {
  it('shows operating, paused and stopped machines', () => {
    expect(machineStatus(db, 'mc-ext01').state).toBe('operating');
    expect(machineStatus(db, 'mc-sel01')).toMatchObject({ state: 'paused', pauseType: 'active' });
    expect(machineStatus(db, 'mc-trq01').state).toBe('stopped');
  });
});

describe('prices in force (RF-26)', () => {
  it('latest validity up to the date wins', () => {
    const records = [{ validFrom: '2026-09-01', v: 1 }, { validFrom: '2026-11-01', v: 2 }, { validFrom: '2026-12-01', v: 3 }];
    expect(inForce(records, '2026-11-15')!.v).toBe(2);
    expect(inForce(records, '2026-08-01')).toBeUndefined();
  });
  it('reference price prefers local on ties: PEBD 1,50', () => {
    expect(referencePrice(db.supplierPrices, db.suppliers, 'm-pebd', NOW.toISOString())).toBe(1.5);
    expect(quotesFor(db.supplierPrices, db.suppliers, 'm-pebd', NOW.toISOString())).toHaveLength(3);
  });
  it('a newer price becomes the reference', () => {
    const prices = [...db.supplierPrices, { id: 'x', materialId: 'm-pebd', supplierId: 's-global', price: 1.3, leadTimeDays: 35, validFrom: '2026-11-02', createdBy: 'u' }];
    expect(referencePrice(prices, db.suppliers, 'm-pebd', NOW.toISOString())).toBe(1.3);
  });
});
