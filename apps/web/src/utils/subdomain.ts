/**
 * Which association (tenant) a web address belongs to, or null when it belongs to none.
 *
 * The old copies of this rule said "three or more dot-separated parts means the first one is a
 * subdomain". That is wrong for `societyledger.com.ng`: `.com.ng` has two parts, so the main site
 * itself has three and "societyledger" was treated as an association, which does not exist (the API
 * answered 404 on every page load, and auth requests carried a bogus tenant). The rule is now based
 * on the real base domain (NEXT_PUBLIC_BASE_DOMAIN), so it does not depend on how many parts the
 * domain ending has.
 *
 *   societyledger.com.ng        -> null   (the main site)
 *   www.societyledger.com.ng    -> null
 *   oko.societyledger.com.ng    -> "oko"
 *   oko.localhost:3000          -> "oko"  (local development)
 *
 * Pure and edge-safe (used by middleware.ts), so it must not import anything.
 */
const DEFAULT_BASE_DOMAIN = 'societyledger.com.ng';

export function extractSubdomainFromHost(
  rawHost: string | null | undefined,
  baseDomain: string | undefined = process.env.NEXT_PUBLIC_BASE_DOMAIN,
): string | null {
  if (!rawHost) return null;
  const host = rawHost.split(':')[0]?.trim().toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;

  const firstLabel = (value: string) => {
    const label = value.split('.')[0];
    return label && label !== 'www' ? label : null;
  };

  // Local development: demo.localhost
  if (host.endsWith('.localhost')) return firstLabel(host);

  const base = (baseDomain || DEFAULT_BASE_DOMAIN).split(':')[0]?.trim().toLowerCase();
  if (base && base !== 'localhost') {
    if (host === base || host === `www.${base}`) return null;
    if (host.endsWith(`.${base}`)) return firstLabel(host.slice(0, -(base.length + 1)));
  }

  // Any other domain (a preview deployment, an old host). A site such as societyledger.netlify.app has
  // three parts and is the site itself, so only four or more parts (oko.societyledger.netlify.app)
  // count as an association there.
  const parts = host.split('.');
  if (parts.length < 4) return null;
  return firstLabel(host);
}
