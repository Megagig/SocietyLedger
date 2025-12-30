import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedAssociation {
  id: number;
  name: string;
  subdomain: string;
}

interface SuperAdminContextState {
  selectedAssociation: SelectedAssociation | null;
  setSelectedAssociation: (association: SelectedAssociation | null) => void;
  clearSelectedAssociation: () => void;
}

/**
 * Store for Super Admin's selected association context.
 * This allows Super Admins to view dashboard data for a specific association
 * without needing to impersonate or switch subdomains.
 */
export const useSuperAdminContext = create<SuperAdminContextState>()(
  persist(
    (set) => ({
      selectedAssociation: null,
      
      setSelectedAssociation: (association) => {
        set({ selectedAssociation: association });
      },
      
      clearSelectedAssociation: () => {
        set({ selectedAssociation: null });
      },
    }),
    {
      name: 'super-admin-context',
    }
  )
);

export default useSuperAdminContext;
