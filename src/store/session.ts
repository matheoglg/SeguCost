// Prototype session (RF-01). No real authentication: users and passwords come from the seed.
import { create } from 'zustand';

import type { User } from '@/domain/types';
import { useDataStore } from './data';

export const LOGIN_ERROR = 'Usuario o contraseña incorrectos';

interface SessionState {
  userId: string | null;
  login: (username: string, password: string) => { ok: true; user: User } | { ok: false; error: string };
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  login: (username, password) => {
    const user = useDataStore
      .getState()
      .db.users.find((u) => u.username === username.trim().toLowerCase() && u.password === password);
    // Inactive accounts get the same generic message (RF-01, RF-02).
    if (!user || !user.active) return { ok: false, error: LOGIN_ERROR };
    set({ userId: user.id });
    return { ok: true, user };
  },
  logout: () => set({ userId: null }),
}));

export function useCurrentUser(): User | undefined {
  const userId = useSessionStore((s) => s.userId);
  return useDataStore((s) => s.db.users.find((u) => u.id === userId));
}
