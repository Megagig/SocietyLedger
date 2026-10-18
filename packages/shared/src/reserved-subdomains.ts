// §16.5 — subdomains permanently reserved for platform use.
// Signup and check-subdomain reject these with 409 SUBDOMAIN_RESERVED.
// extractSubdomain / extractSubdomainFromOrigin return null for them so
// an Origin of https://admin.societyledger.com.ng never resolves a tenant.
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'admin',
  'docs',
  'www',
  'api',
  'app',
  'platform',
  'mail',
  'status',
  'staging',
  'preview',
  'cdn',
  'static',
  'help',
  'support',
  'blog',
  'docs-staging',
  'admin-staging',
  'api-staging',
] as const;
