// Time and pause report (RF-40). The same rows feed the screen, Excel and PDF (RF-41).
import { dateKey } from './prices';
import { timeBreakdown } from './production';
import type { Database } from './types';

export interface TimeReportFilters {
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
  operatorId?: string;
  machineId?: string;
}

export interface TimeReportRow {
  operatorId: string;
  entries: number;
  totalMs: number;
  effectiveMs: number;
  activePauseMs: number;
  restMs: number;
  machineMs: number; // effective time on a machine (packing is manual)
  effectiveShare: number; // effective / total
}

export function timeReport(db: Database, filters: TimeReportFilters, now: Date = new Date()): { rows: TimeReportRow[]; total: TimeReportRow } {
  const entries = db.timeEntries.filter((t) => {
    const day = dateKey(t.start);
    return (
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to) &&
      (!filters.operatorId || t.operatorId === filters.operatorId) &&
      (!filters.machineId || t.machineId === filters.machineId)
    );
  });
  const empty = (operatorId: string): TimeReportRow => ({ operatorId, entries: 0, totalMs: 0, effectiveMs: 0, activePauseMs: 0, restMs: 0, machineMs: 0, effectiveShare: 0 });
  const byOperator = new Map<string, TimeReportRow>();
  const total = empty('total');
  for (const e of entries) {
    const b = timeBreakdown(e, now);
    for (const row of [byOperator.get(e.operatorId) ?? empty(e.operatorId), total]) {
      row.entries += 1;
      row.totalMs += b.totalMs;
      row.effectiveMs += b.effectiveMs;
      row.activePauseMs += b.activePauseMs;
      row.restMs += b.restMs;
      if (e.machineId) row.machineMs += b.effectiveMs;
      if (row !== total) byOperator.set(e.operatorId, row);
    }
  }
  const rows = [...byOperator.values()];
  for (const r of [...rows, total]) r.effectiveShare = r.totalMs ? r.effectiveMs / r.totalMs : 0;
  return { rows, total };
}
