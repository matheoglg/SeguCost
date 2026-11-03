// UI state shared between screens (not part of the business data).
import { create } from 'zustand';

export interface PriceChange {
  materialId: string;
  supplierId: string;
  oldPrice: number;
  newPrice: number;
  at: string;
}

interface UiState {
  /** "Simular sin conexión" switch in M-01 (RNF-11). */
  offline: boolean;
  /** Marks saved while offline, waiting to sync. */
  pendingSync: number;
  /** Last supplier price saved in W-11, shown in W-15. */
  lastPriceChange?: PriceChange;
  /** Unit cost passed from W-14/W-15 to the simulator W-16. */
  simulatorPreset?: { productId: string; unitCost: number; source: string };
  setOffline: (offline: boolean) => number;
  queueSync: () => void;
  setLastPriceChange: (change: PriceChange) => void;
  setSimulatorPreset: (preset: UiState['simulatorPreset']) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  offline: false,
  pendingSync: 0,
  /** Returns how many marks were synced when the signal comes back. */
  setOffline: (offline) => {
    const synced = offline ? 0 : get().pendingSync;
    set({ offline, pendingSync: offline ? get().pendingSync : 0 });
    return synced;
  },
  queueSync: () => {
    if (get().offline) set((s) => ({ pendingSync: s.pendingSync + 1 }));
  },
  setLastPriceChange: (lastPriceChange) => set({ lastPriceChange }),
  setSimulatorPreset: (simulatorPreset) => set({ simulatorPreset }),
}));
