// In-memory database shared by the web and mobile screens. Web and mobile run in the same
// app during the demo, so the plant monitor (W-10) reads what the phone writes here.
import { create } from 'zustand';

import { createSeed } from '@/data/seed';
import { computeOrderCost } from '@/domain/costing';
import type { AuditEntry, Database } from '@/domain/types';

/** Seed plus the cost snapshots of the orders that are already closed. */
export function loadDatabase(now: Date = new Date()): Database {
  const db = createSeed(now);
  db.orderCosts = db.orders.filter((o) => o.status === 'closed').map((o) => computeOrderCost(db, o.id, o.closedAt!));
  return db;
}

let idSeq = 0;
/** Unique id for records created during the demo. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++idSeq).toString(36)}`;

interface DataState {
  db: Database;
  /** Applies a change to the database; module actions build on top of this. */
  update: (recipe: (db: Database) => Partial<Database>) => void;
  /** Appends an audit entry (RF-04). */
  audit: (entry: Omit<AuditEntry, 'id' | 'at'>) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  db: loadDatabase(),
  update: (recipe) => set((state) => ({ db: { ...state.db, ...recipe(state.db) } })),
  audit: (entry) =>
    set((state) => ({
      db: { ...state.db, auditLog: [...state.db.auditLog, { ...entry, id: newId('au'), at: new Date().toISOString() }] },
    })),
  reset: () => set({ db: loadDatabase() }),
}));
