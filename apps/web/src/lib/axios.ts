import axios from 'axios';
import { getTenantHeaders } from '@/utils/tenant';
import { useModuleLockStore } from '@/store/moduleLockStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Axios instance configured with tenant context
 * Automatically adds x-tenant header based on subdomain
 */
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  timeout: 30000, // 30 second timeout
});

// Add auth token and tenant headers to all requests
// Headers are fetched fresh on each request to ensure Super Admin context is current
api.interceptors.request.use((config) => {
  // Add Authorization header from localStorage
  if (typeof window !== 'undefined') {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
          config.headers.set('Authorization', `Bearer ${state.token}`);
        }
      } catch (error) {
        console.error('[API] Error parsing auth storage:', error);
      }
    }
  }

  // Get fresh tenant headers (includes X-Association-Id from localStorage)
  const tenantHeaders = getTenantHeaders();
  
  Object.entries(tenantHeaders).forEach(([key, value]) => {
    if (value) {
      config.headers.set(key, value);
    }
  });
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    const associationId = (tenantHeaders as Record<string, string>)['X-Association-Id'];
    if (associationId) {
      console.log('[API] Request with X-Association-Id:', associationId, config.url);
    }
  }
  
  return config;
});

// G13: surface a locked-module/feature response as a real upgrade prompt instead of
// letting it fall through as a generic failed request.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.response?.data?.error;
    if (code === 'MODULE_DISABLED' || code === 'FEATURE_DISABLED' || code === 'MODULES_DISABLED' || code === 'NO_MODULE_AVAILABLE') {
      useModuleLockStore.getState().open(
        error.response.data.message || 'This feature is not available on your current plan.',
        Boolean(error.response.data.upgradeRequired)
      );
    }
    return Promise.reject(error);
  }
);

export default api;
