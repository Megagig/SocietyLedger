import { create } from 'zustand';

interface ModuleLockState {
  isOpen: boolean;
  title: string;
  message: string;
  upgradeRequired: boolean;
  open: (message: string, upgradeRequired: boolean, title?: string) => void;
  close: () => void;
}

// G13: a single shared place for the upgrade-prompt modal triggered whenever the API
// returns MODULE_DISABLED/FEATURE_DISABLED, instead of building a bespoke locked state
// per page. Both lib/axios.ts (api instance) and utils/api.ts (apiFetch) report into this.
export const useModuleLockStore = create<ModuleLockState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  upgradeRequired: false,
  open: (message, upgradeRequired, title = '') => set({ isOpen: true, message, upgradeRequired, title }),
  close: () => set({ isOpen: false }),
}));
