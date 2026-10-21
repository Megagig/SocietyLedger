/**
 * Where a tenant's own app lives. Production tenants are `https://<subdomain>.societyledger.com.ng`;
 * in local dev the web app serves tenants on `http://<subdomain>.localhost:3000`, so the template is
 * configurable via `NEXT_PUBLIC_TENANT_URL_TEMPLATE` (use `{subdomain}` as the placeholder).
 * Referencing `process.env.NEXT_PUBLIC_*` directly is what lets Next inline it into client bundles.
 */
const TEMPLATE = process.env.NEXT_PUBLIC_TENANT_URL_TEMPLATE ?? 'https://{subdomain}.societyledger.com.ng';

export function tenantUrl(subdomain: string, path = ''): string {
  return TEMPLATE.replace('{subdomain}', subdomain).replace(/\/+$/, '') + path;
}
