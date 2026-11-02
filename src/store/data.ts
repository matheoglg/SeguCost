// In-memory database shared by the web and mobile screens. Web and mobile run in the same
// app during the demo, so the plant monitor (W-10) reads what the phone writes here.
import { create } from 'zustand';

import { createSeed } from '@/data/seed';
import type { Database } from '@/domain/types';

interface DataState {
  db: Database;
  /** Applies a change to the database; module stores build their actions on top of this. */
  update: (recipe: (db: Database) => Partial<Database>) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  db: createSeed(),
  update: (recipe) => set((state) => ({ db: { ...state.db, ...recipe(state.db) } })),
  reset: () => set({ db: createSeed() }),
}));
