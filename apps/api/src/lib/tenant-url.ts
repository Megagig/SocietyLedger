/**
 * Where a signed-in officer of an association actually is: the association's own address (`oko-youth-forum.localhost:3000`,
 * `oko.societyledger.com.ng`), not the bare app address in FRONTEND_URL. Someone signed in on the first has no session on the second,
 * so a payment page that sends them back to FRONTEND_URL cannot confirm anything for them.
 */
export function tenantBaseUrl(subdomain: string | null | undefined, frontendUrl: string | undefined = process.env.FRONTEND_URL): string {
  const base = (frontendUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const clean = (subdomain ?? '').trim().toLowerCase();
  if (!clean || !/^[a-z0-9-]+$/.test(clean)) return base;
  const match = base.match(/^(https?:\/\/)(.+)$/);
  if (!match) return base;
  const host = match[2];
  // Already on the tenant's address (or one of its subdomains)
  if (host === clean || host.startsWith(`${clean}.`)) return base;
  return `${match[1]}${clean}.${host.replace(/^www\./, '')}`;
}
