import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { API_ROUTES } from '@/utils/constants';
import { createFetchHeaders } from '@/utils/tenant';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
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
      setToken: (token) => set({ token }),
      
      setImpersonation: (association) => {
        const currentUser = get().user;
        set({
          isImpersonating: true,
          impersonatedAssociation: association,
          originalAssociationId: currentUser?.associationId || null,
        });
      },
      
      endImpersonation: async () => {
        const token = get().token;
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
            set({
              token: data.data.token,
              isImpersonating: false,
              impersonatedAssociation: null,
              originalAssociationId: null,
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
    }
  )
);