import { createFetchHeaders } from './tenant';

/**
 * Make an authenticated API request with tenant context
 * @param url - The API URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = createFetchHeaders({
    'Content-Type': 'application/json',
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
 * Make a DELETE request to the API
 */
export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' });
}
