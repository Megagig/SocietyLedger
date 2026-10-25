import { create } from 'zustand';

/**
 * architecture.md §5/§6.3 — modules found disabled *this session*. Not persisted: a module can
 * be re-enabled server-side between sessions, and this store only exists to drive the
 * `ModuleLocked` state after a real `403 MODULE_DISABLED`/`FEATURE_DISABLED` response, not as a
 * cache of plan entitlements.
 */
export type ModulesState = {
  disabled: Set<string>;
  markDisabled: (module: string) => void;
  isDisabled: (module: string) => boolean;
  reset: () => void;
};

export const useModulesStore = create<ModulesState>((set, get) => ({
  disabled: new Set(),
  markDisabled: (module) => set((state) => ({ disabled: new Set(state.disabled).add(module) })),
  isDisabled: (module) => get().disabled.has(module),
  reset: () => set({ disabled: new Set() }),
}));
