/**
 * Get the base domain for the application
 * Returns the appropriate domain based on environment
 */
export function getBaseDomain(): string {
  // Check if we're in browser
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on localhost, return localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost:3000';
    }
    
    // If on Netlify or production, extract the base domain
    // e.g., from "iyesibrothers.societyledger.netlify.app" get "societyledger.netlify.app"
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      // Remove subdomain, keep base domain
      return parts.slice(-3).join('.');
    }
    
    return hostname;
  }
  
  // Server-side: use environment variable or default
  return process.env.NEXT_PUBLIC_BASE_DOMAIN || 'societyledger.netlify.app';
}

/**
 * Get the full URL for a subdomain
 */
export function getSubdomainUrl(subdomain: string): string {
  const baseDomain = getBaseDomain();
  const protocol = baseDomain.includes('localhost') ? 'http' : 'https';
  
  return `${protocol}://${subdomain}.${baseDomain}`;
}

/**
 * Get the display domain (without protocol)
 */
export function getDisplayDomain(): string {
  return getBaseDomain();
}
