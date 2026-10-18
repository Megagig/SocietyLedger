import { create } from 'zustand';

interface ModuleLockState {
  isOpen: boolean;
  message: string;
  upgradeRequired: boolean;
  open: (message: string, upgradeRequired: boolean) => void;
  close: () => void;
}

// G13: a single shared place for the upgrade-prompt modal triggered whenever the API
// returns MODULE_DISABLED/FEATURE_DISABLED, instead of building a bespoke locked state
// per page. Both lib/axios.ts (api instance) and utils/api.ts (apiFetch) report into this.
export const useModuleLockStore = create<ModuleLockState>((set) => ({
  isOpen: false,
  message: '',
  upgradeRequired: false,
  open: (message, upgradeRequired) => set({ isOpen: true, message, upgradeRequired }),
  close: () => set({ isOpen: false }),
}));
