import axios from 'axios';
import { getTenantHeaders } from '@/utils/tenant';

/**
 * Axios instance configured with tenant context
 * Automatically adds x-tenant header based on subdomain
 */
const api = axios.create({
  withCredentials: true,
});

// Add tenant headers to all requests
api.interceptors.request.use((config) => {
  const tenantHeaders = getTenantHeaders();
  Object.entries(tenantHeaders).forEach(([key, value]) => {
    if (value) {
      config.headers.set(key, value);
    }
  });
  return config;
});

export default api;
