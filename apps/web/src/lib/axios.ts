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
