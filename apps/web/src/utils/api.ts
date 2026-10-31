import { createFetchHeaders } from './tenant';
import { useModuleLockStore } from '@/store/moduleLockStore';
import { accessCopy, moduleDisplayName } from '@societyledger/shared';

import { useAuthStore } from '@/store/authStore';

const MODULE_LOCK_ERROR_CODES = new Set(['MODULE_DISABLED', 'FEATURE_DISABLED', 'MODULES_DISABLED', 'NO_MODULE_AVAILABLE']);

/**
 * The token for THIS tab's sign-in.
 *
 * It comes from this site's own saved sign-in (the same place the axios client reads), because that is the only token that is certainly for
 * the association in this tab's address. Without one, the API falls back to its own HttpOnly login cookie, which belongs to the API host and
 * is shared by every association in the browser: it holds whoever signed in last, in any tab, so a person with accounts in two groups
 * would be refused with TENANT_MISMATCH. The readable cookie is only a fallback (impersonation writes it).
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = window.localStorage.getItem('auth-storage');
    if (saved) {
      const token = JSON.parse(saved)?.state?.token;
      if (typeof token === 'string' && token.length > 0) return token;
    }
  } catch {
    // unreadable saved state: fall through to the cookie
  }

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
      if (body?.code === 'SUBSCRIPTION_INACTIVE') {
        useAuthStore.getState().markSubscriptionBlocked(body.reason);
      }
      if (MODULE_LOCK_ERROR_CODES.has(body?.error)) {
        // Same wording as the mobile app and the permission messages: what is missing, and who can add it.
        const copy = accessCopy('plan', { moduleName: moduleDisplayName(body.module), surface: 'web' });
        useModuleLockStore.getState().open(copy.description, Boolean(body.upgradeRequired), copy.title);
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
      if (body?.code === 'SUBSCRIPTION_INACTIVE') {
        useAuthStore.getState().markSubscriptionBlocked(body.reason);
      }
      if (MODULE_LOCK_ERROR_CODES.has(body?.error)) {
        // Same wording as the mobile app and the permission messages: what is missing, and who can add it.
        const copy = accessCopy('plan', { moduleName: moduleDisplayName(body.module), surface: 'web' });
        useModuleLockStore.getState().open(copy.description, Boolean(body.upgradeRequired), copy.title);
      }
    } catch {
      // ignore
    }
  }

  return response;
}
