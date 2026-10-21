import { create } from 'zustand';

import type { PlatformRole } from '@/types/api/enums';

/**
 * architecture.md §7.4/§9 — populated from login/`/auth/me` + SecureStore (token presence),
 * never persisted itself (the query cache persists `/auth/me`'s own response; Zustand only
 * holds the derived, normalised shape for the current in-memory session).
 *
 * A normalised shape of its own, not `LoginUserDTO`/`MeResponseDTO` directly (F1.3's own
 * `auth.ts` DTOs) — those two are deliberately different shapes (login vs. `/me`), and the
 * caller (F2.2's login feature) maps whichever one it just received into this one.
 */
export type SessionMember = {
  id: number;
  firstName: string;
  lastName: string;
  memberId: string;
};

export type SessionUser = {
  id: number;
  email: string;
  role: string;
  permissions: string[];
  roles: string[];
  requiresOnboarding: boolean;
  platformRole: PlatformRole | null;
  member: SessionMember | null;
};

export type SessionStatus = 'idle' | 'authenticated' | 'unauthenticated';

export type SessionState = {
  user: SessionUser | null;
  status: SessionStatus;
  setUser: (user: SessionUser | null) => void;
  setStatus: (status: SessionStatus) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  setStatus: (status) => set({ status }),
  reset: () => set({ user: null, status: 'unauthenticated' }),
}));
