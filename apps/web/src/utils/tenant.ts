/**
 * Extract subdomain from hostname
 * Handles both regular domains and .localhost TLD
 * @param hostname - The hostname to extract subdomain from
 * @returns The subdomain or null if none found
 */
export function extractSubdomain(hostname: string): string | null {
  const host = hostname.toLowerCase();
  
  // Handle .localhost TLD (e.g., demo.localhost)
  if (host.endsWith('.localhost')) {
    const parts = host.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      return sub !== 'www' ? sub : null;
    }
  }
  
  // Handle regular domains
  if (host === 'localhost' || host === '127.0.0.1') return null;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const [sub] = parts;
  if (sub === 'www') return null;
  return sub;
}

/**
 * Get tenant headers for API requests
 * Automatically extracts subdomain and creates x-tenant header
 * @returns Headers object with x-tenant if subdomain exists
 */
export function getTenantHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  
  const subdomain = extractSubdomain(window.location.hostname);
  
  return subdomain ? { 'x-tenant': subdomain } : {};
}

/**
 * Create fetch headers with tenant context
 * Merges provided headers with tenant headers
 * @param headers - Additional headers to include
 * @returns Merged headers with tenant context
 */
export function createFetchHeaders(headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    ...getTenantHeaders(),
  };
}
