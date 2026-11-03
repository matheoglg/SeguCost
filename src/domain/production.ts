// Plant rules: order lifecycle, waste and time tracking (RF-16, RF-17, RF-20, RF-21, RF-23, RF-25).
import type { Database, OrderStatus, PauseType, TimeEntry } from './types';

// ---- order lifecycle (Figure 5.1) ----

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['inProgress', 'cancelled'],
  inProgress: ['toValidate'],
  toValidate: ['closed', 'inProgress'],
  closed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// ---- waste ----

/** Waste as a fraction of the raw material used: 3,5 kg / 100 kg -> 0.035. */
export function wastePercent(wasteKg: number, rawMaterialKg: number): number {
  return rawMaterialKg > 0 ? wasteKg / rawMaterialKg : 0;
}

/** Alert when waste strictly exceeds the configured maximum (3 % by default). */
export function isWasteAlert(wasteFraction: number, threshold: number): boolean {
  return wasteFraction > threshold;
}

export function orderStageIds(db: Database, orderId: string): Set<string> {
  return new Set(db.stages.filter((s) => s.orderId === orderId).map((s) => s.id));
}

/** Raw material used (extrusion records), total waste and waste fraction of an order. */
export function orderWaste(db: Database, orderId: string) {
  const ids = orderStageIds(db, orderId);
  const rawKg = db.productionRecords.filter((r) => ids.has(r.stageId)).reduce((t, r) => t + (r.rawMaterialKg ?? 0), 0);
  const wasteKg = db.wasteRecords.filter((w) => ids.has(w.stageId)).reduce((t, w) => t + w.kg, 0);
  const fraction = wastePercent(wasteKg, rawKg);
  return { rawKg, wasteKg, fraction, alert: isWasteAlert(fraction, db.settings.maxWastePct) };
}

// ---- packing (RF-18) ----

/** Final count against the ordered quantity: 10.000 ordered, 9.950 counted -> short by 50. */
export function countDifference(ordered: number, counted: number): { kind: 'short' | 'over' | 'exact'; amount: number } {
  const diff = counted - ordered;
  return { kind: diff === 0 ? 'exact' : diff < 0 ? 'short' : 'over', amount: Math.abs(diff) };
}

// ---- time ----

/** Effective time = total − active pauses − rests (RF-23). */
export function effectiveTime(totalMs: number, ...pausesMs: number[]): number {
  return Math.max(0, totalMs - pausesMs.reduce((t, p) => t + p, 0));
}

const ms = (iso: string) => new Date(iso).getTime();

export interface TimeBreakdown {
  totalMs: number;
  activePauseMs: number;
  restMs: number;
  effectiveMs: number;
}

/** Splits a time entry; open entries and pauses are measured up to `now`. */
export function timeBreakdown(entry: TimeEntry, now: Date = new Date()): TimeBreakdown {
  const end = entry.end ? ms(entry.end) : now.getTime();
  const totalMs = Math.max(0, end - ms(entry.start));
  const pauseMs = (type: PauseType) =>
    entry.pauses
      .filter((p) => p.type === type)
      .reduce((t, p) => t + Math.max(0, (p.end ? ms(p.end) : end) - ms(p.start)), 0);
  const activePauseMs = pauseMs('active');
  const restMs = pauseMs('rest');
  return { totalMs, activePauseMs, restMs, effectiveMs: effectiveTime(totalMs, activePauseMs, restMs) };
}

export function sumBreakdowns(list: TimeBreakdown[]): TimeBreakdown {
  return list.reduce(
    (t, b) => ({
      totalMs: t.totalMs + b.totalMs,
      activePauseMs: t.activePauseMs + b.activePauseMs,
      restMs: t.restMs + b.restMs,
      effectiveMs: t.effectiveMs + b.effectiveMs,
    }),
    { totalMs: 0, activePauseMs: 0, restMs: 0, effectiveMs: 0 },
  );
}

/** Currently open pause of a running entry, if any. */
export const openPause = (entry: TimeEntry) => entry.pauses.find((p) => !p.end);

// ---- plant monitor ----

export type MachineState = 'operating' | 'paused' | 'stopped';

export interface MachineStatus {
  state: MachineState;
  pauseType?: PauseType;
  since?: string; // start of the current state
  entry?: TimeEntry;
}

export function machineStatus(db: Database, machineId: string): MachineStatus {
  const entry = db.timeEntries.find((t) => t.machineId === machineId && !t.end);
  if (entry) {
    const pause = openPause(entry);
    if (pause) return { state: 'paused', pauseType: pause.type, since: pause.start, entry };
    const lastPauseEnd = entry.pauses.map((p) => p.end!).sort().at(-1);
    return { state: 'operating', since: lastPauseEnd ?? entry.start, entry };
  }
  const lastEnd = db.timeEntries
    .filter((t) => t.machineId === machineId && t.end)
    .map((t) => t.end!)
    .sort()
    .at(-1);
  return { state: 'stopped', since: lastEnd };
}
