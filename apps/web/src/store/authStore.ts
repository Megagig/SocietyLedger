import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { API_ROUTES } from '@/utils/constants';
import { createFetchHeaders } from '@/utils/tenant';

// Import super admin context for clearing during end impersonation
// Using dynamic import to avoid circular dependencies
const clearSuperAdminContext = () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('super-admin-context');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.state.selectedAssociation = null;
        localStorage.setItem('super-admin-context', JSON.stringify(parsed));
      }
    } catch (e) {
      console.error('Failed to clear super admin context:', e);
    }
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Hydration tracking for SSR
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  
  // Phase 22: Impersonation tracking
  isImpersonating: boolean;
  impersonatedAssociation: { id: number; name: string; subdomain: string } | null;
  originalAssociationId: number | null;
  
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  register: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  
  // Phase 22: Impersonation actions
  setToken: (token: string) => void;
  setImpersonation: (association: { id: number; name: string; subdomain: string }) => void;
  startImpersonation: (token: string, association: { id: number; name: string; subdomain: string }) => void;
  endImpersonation: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      // Hydration tracking
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      // Phase 22: Impersonation state
      isImpersonating: false,
      impersonatedAssociation: null,
      originalAssociationId: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(API_ROUTES.AUTH.LOGIN, {
            method: 'POST',
            headers: createFetchHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(credentials),
            credentials: 'include',
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          set({
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          return false;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(API_ROUTES.AUTH.REGISTER, {
            method: 'POST',
            headers: createFetchHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(data),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.message || 'Registration failed');
          }

          set({
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          set({
            isLoading: false,
            error: errorMessage,
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await fetch(API_ROUTES.AUTH.LOGOUT, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        const { token } = get();
        
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const response = await fetch(API_ROUTES.AUTH.ME, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Authentication failed');
          }

          const data = await response.json();
          set({
            user: data.data.user || data.data,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      // Phase 22: Impersonation actions
      setToken: (token) => {
        // Update Zustand store
        set({ token });
        
        // CRITICAL: Also update the cookie so API calls use the new token
        if (typeof document !== 'undefined') {
          document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
        }
      },
      
      setImpersonation: (association) => {
        const currentUser = get().user;
        set({
          isImpersonating: true,
          impersonatedAssociation: association,
          originalAssociationId: currentUser?.associationId || null,
        });
      },
      
      startImpersonation: (token, association) => {
        const currentUser = get().user;
        
        // Update cookie
        if (typeof document !== 'undefined') {
          document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
        }
        
        // Update all state at once
        set({
          token,
          isImpersonating: true,
          impersonatedAssociation: association,
          originalAssociationId: currentUser?.associationId || null,
          // Update user's associationId to match impersonated association
          user: currentUser ? {
            ...currentUser,
            associationId: association.id,
          } : null,
        });
      },
      
      endImpersonation: async () => {
        const token = get().token;
        const originalAssociationId = get().originalAssociationId;
        const currentUser = get().user;
        if (!token) return false;
        
        try {
          const response = await fetch(API_ROUTES.ADMIN.END_IMPERSONATION, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          
          const data = await response.json();
          if (data.success) {
            // Clear the super admin context so API calls don't include old association
            clearSuperAdminContext();
            
            // Update the cookie with the new token
            if (typeof document !== 'undefined') {
              document.cookie = `token=${data.data.token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
            }
            
            set({
              token: data.data.token,
              isImpersonating: false,
              impersonatedAssociation: null,
              originalAssociationId: null,
              // Restore user's original associationId
              user: currentUser ? {
                ...currentUser,
                associationId: originalAssociationId || undefined,
              } : null,
            });
            return true;
          }
          return false;
        } catch (error) {
          console.error('Failed to end impersonation:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Phase 22: Persist impersonation state
        isImpersonating: state.isImpersonating,
        impersonatedAssociation: state.impersonatedAssociation,
        originalAssociationId: state.originalAssociationId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);