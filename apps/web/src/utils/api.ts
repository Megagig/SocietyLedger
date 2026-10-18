import { createFetchHeaders } from './tenant';
import { useModuleLockStore } from '@/store/moduleLockStore';

const MODULE_LOCK_ERROR_CODES = new Set(['MODULE_DISABLED', 'FEATURE_DISABLED', 'MODULES_DISABLED', 'NO_MODULE_AVAILABLE']);

/**
 * Get auth token from cookie or localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try to get from cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'token') return value;
  }
  
  return null;
}

/**
 * Make an authenticated API request with tenant context
 * @param url - The API URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const headers = createFetchHeaders({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  });

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // G13: surface a locked-module/feature response as a real upgrade prompt. Clone
  // the response so the original caller can still read the body normally.
  if (response.status === 403) {
    try {
      const body = await response.clone().json();
      if (MODULE_LOCK_ERROR_CODES.has(body?.error)) {
        useModuleLockStore.getState().open(
          body.message || 'This feature is not available on your current plan.',
          Boolean(body.upgradeRequired)
        );
      }
    } catch {
      // Not JSON or already consumed — ignore, not a module-lock response
    }
  }

  return response;
}

/**
 * Make a GET request to the API
 */
export async function apiGet(url: string): Promise<Response> {
  return apiFetch(url, { method: 'GET' });
}

/**
 * Make a POST request to the API
 */
export async function apiPost(url: string, data?: any): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a PATCH request to the API
 */
export async function apiPatch(url: string, data?: any): Promise<Response> {
  return apiFetch(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a PUT request to the API
 */
export async function apiPut(url: string, data?: any): Promise<Response> {
  return apiFetch(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a DELETE request to the API
 */
export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' });
}

/**
 * Make a POST request with a multipart FormData body (file upload) — R7.2 (G17).
 * Does not set Content-Type: application/json like apiFetch does by default, since
 * the browser must set the multipart boundary itself.
 */
export async function apiPostFormData(url: string, formData: FormData): Promise<Response> {
  const token = getAuthToken();
  const headers = createFetchHeaders({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (response.status === 403) {
    try {
      const body = await response.clone().json();
      if (MODULE_LOCK_ERROR_CODES.has(body?.error)) {
        useModuleLockStore.getState().open(
          body.message || 'This feature is not available on your current plan.',
          Boolean(body.upgradeRequired)
        );
      }
    } catch {
      // ignore
    }
  }

  return response;
}
