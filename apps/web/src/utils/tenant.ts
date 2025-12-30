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
 * Get Super Admin's selected association ID from localStorage
 * This allows Super Admins to view data for a specific association
 */
function getSuperAdminAssociationId(): number | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('super-admin-context');
    console.log('[Tenant] localStorage super-admin-context:', stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[Tenant] Parsed:', parsed);
      const id = parsed?.state?.selectedAssociation?.id || null;
      console.log('[Tenant] Association ID:', id);
      return id;
    }
  } catch (e) {
    console.error('[Tenant] Error reading localStorage:', e);
  }
  return null;
}

/**
 * Get tenant headers for API requests
 * Automatically extracts subdomain and creates x-tenant header
 * Also includes X-Association-Id for Super Admin context
 * @returns Headers object with tenant context
 */
export function getTenantHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  
  const subdomain = extractSubdomain(window.location.hostname);
  const headers: Record<string, string> = {};
  
  if (subdomain) {
    headers['x-tenant'] = subdomain;
  }
  
  // Add Super Admin's selected association context
  const superAdminAssociationId = getSuperAdminAssociationId();
  if (superAdminAssociationId) {
    headers['X-Association-Id'] = superAdminAssociationId.toString();
  }
  
  return headers;
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
