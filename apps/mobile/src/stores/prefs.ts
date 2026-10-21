import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { storage } from '@/lib/storage';

/** architecture.md §7.5 — default 5 min background timeout before the app re-locks. */
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};

export type PrefsState = {
  biometricsEnabled: boolean;
  autoLockMinutes: number;
  /** Tracks the once-after-first-login opt-in prompt (architecture.md §7.5) — distinct from
   * `biometricsEnabled` itself, so declining doesn't re-prompt on every subsequent login. */
  hasSeenBiometricPrompt: boolean;
  /** ui-rules.md §5.1 — the Passbook's eye icon, "preference persisted". */
  balanceHidden: boolean;
  setBiometricsEnabled: (enabled: boolean) => void;
  setAutoLockMinutes: (minutes: number) => void;
  markBiometricPromptSeen: () => void;
  toggleBalanceHidden: () => void;
};

/** `prefs.*` namespace (library-docs.md's react-native-mmkv note) — theme (F1.2's `ThemeProvider`)
 * keeps its own separate mechanism in the same namespace; this store is code-standards.md §9's
 * one general "prefs" slot otherwise (biometrics/autoLock at F2.4, balance visibility at F2.5).
 * Persist key renamed from F2.4's `'prefs.appLock'` to the more accurate `'prefs.general'` — safe
 * before launch, nothing has shipped with the old key yet. */
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      biometricsEnabled: false,
      autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
      hasSeenBiometricPrompt: false,
      balanceHidden: false,
      setBiometricsEnabled: (biometricsEnabled) => set({ biometricsEnabled }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      markBiometricPromptSeen: () => set({ hasSeenBiometricPrompt: true }),
      toggleBalanceHidden: () => set((state) => ({ balanceHidden: !state.balanceHidden })),
    }),
    { name: 'prefs.general', storage: createJSONStorage(() => mmkvStateStorage) },
  ),
);
