import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { storage } from '@/lib/storage';
import type { CheckSubdomainResponseDTO } from '@/types/api/associations';

export type TenantSummary = CheckSubdomainResponseDTO;

const MAX_RECENT = 5;

export type TenantState = {
  current: TenantSummary | null;
  /** Most-recent-first, max 5 (architecture.md §7.1). */
  recent: TenantSummary[];
  setCurrent: (tenant: TenantSummary) => void;
  clearCurrent: () => void;
};

const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};

/** `tenant.*` namespace (library-docs.md's react-native-mmkv note). */
export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      current: null,
      recent: [],
      setCurrent: (tenant) => {
        const recent = [tenant, ...get().recent.filter((r) => r.subdomain !== tenant.subdomain)].slice(0, MAX_RECENT);
        set({ current: tenant, recent });
      },
      // Full "switch association" sign-out (revoke refresh token, clear query cache, clear
      // session) is orchestrated by the caller (F2.x's auth flow) — this store only clears its
      // own slice.
      clearCurrent: () => set({ current: null }),
    }),
    { name: 'tenant.store', storage: createJSONStorage(() => mmkvStateStorage) },
  ),
);
