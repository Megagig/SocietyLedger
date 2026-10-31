/**
 * How many reverse proxies sit between a visitor and this API, so Express can tell who is really calling.
 *
 * In production the API is reached through Dokploy's Traefik (one proxy). Without telling Express that, `req.ip` is the proxy's own address for
 * EVERY visitor, so everything keyed on it (the rate limits, the login attempt limit, the security audit log) treats the whole platform as one
 * person: a single shared "100 requests a minute", and failed logins from anyone count against everyone.
 *
 * `1` means "trust the nearest proxy and take the client address it recorded". It must be the true number of hops: too low leaves the shared
 * address, too high lets a visitor forge their own address by sending an X-Forwarded-For header. Set TRUST_PROXY_HOPS if a second proxy is ever
 * put in front (for example Cloudflare: 2). Locally there is no proxy, so the default there is 0.
 */
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (raw) {
    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0 && hops <= 5) return hops;
  }
  return env.NODE_ENV === 'production' ? 1 : 0;
}
