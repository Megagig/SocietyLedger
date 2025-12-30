import { createFetchHeaders } from './tenant';

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

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
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
