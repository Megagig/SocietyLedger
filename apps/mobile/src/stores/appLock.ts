import { create } from 'zustand';

/**
 * architecture.md §7.5 — runtime lock state, deliberately **not** persisted (unlike `prefs.ts`):
 * a fresh `isLocked: true` on every cold start/new JS process is exactly "lock on cold start" for
 * free, with no special-casing. `(app)/_layout.tsx`'s guard only actually redirects to the lock
 * screen when `isLocked && usePrefsStore.getState().biometricsEnabled` — so this flag starting
 * `true` is harmless for a user who never opted into app lock at all.
 */
export type AppLockState = {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
};

export const useAppLockStore = create<AppLockState>((set) => ({
  isLocked: true,
  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
}));
