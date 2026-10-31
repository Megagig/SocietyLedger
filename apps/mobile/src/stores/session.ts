import { create } from 'zustand';

import type { SubscriptionAccessDTO } from '@/types/api/auth';
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
  /** What kind of account this is, known from the first screen. THRIFT_GROUP is a standalone thrift group (Ajo only). */
  tenantKind?: 'ASSOCIATION' | 'THRIFT_GROUP';
  /** The association's trial / subscription standing; absent when the server did not say. */
  subscriptionAccess?: SubscriptionAccessDTO | null;
  platformRole: PlatformRole | null;
  member: SessionMember | null;
};

export type SessionStatus = 'idle' | 'authenticated' | 'unauthenticated';

export type SessionState = {
  user: SessionUser | null;
  status: SessionStatus;
  setUser: (user: SessionUser | null) => void;
  setStatus: (status: SessionStatus) => void;
  /** The API answered 403 SUBSCRIPTION_INACTIVE: show the blocked screen instead of the app. */
  markSubscriptionBlocked: (reason?: string) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  setStatus: (status) => set({ status }),
  markSubscriptionBlocked: (reason) => {
    const { user } = get();
    if (!user || user.platformRole) return;
    set({
      user: {
        ...user,
        subscriptionAccess: {
          allowed: false,
          reason: reason === 'TRIAL_ENDED' ? 'TRIAL_ENDED' : 'EXPIRED',
          status: user.subscriptionAccess?.status ?? null,
          trialEndsAt: user.subscriptionAccess?.trialEndsAt ?? null,
          trialDaysLeft: null,
        },
      },
    });
  },
  reset: () => set({ user: null, status: 'unauthenticated' }),
}));
