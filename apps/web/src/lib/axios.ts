import axios from 'axios';
import { getTenantHeaders } from '@/utils/tenant';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Axios instance configured with tenant context
 * Automatically adds x-tenant header based on subdomain
 */
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// Add tenant headers to all requests
// Headers are fetched fresh on each request to ensure Super Admin context is current
api.interceptors.request.use((config) => {
  // Get fresh tenant headers (includes X-Association-Id from localStorage)
  const tenantHeaders = getTenantHeaders();
  
  Object.entries(tenantHeaders).forEach(([key, value]) => {
    if (value) {
      config.headers.set(key, value);
    }
  });
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    const associationId = tenantHeaders['X-Association-Id'];
    if (associationId) {
      console.log('[API] Request with X-Association-Id:', associationId, config.url);
    }
  }
  
  return config;
});

export default api;
