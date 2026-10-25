import { parseDeepLink } from '@/lib/linking';

/**
 * architecture.md §8.3 — rewrites an incoming `societyledger://...` system URL into an in-app
 * route before Expo Router handles it. `path` isn't guaranteed to be a valid URL (Expo Router's
 * own docs note this) — normalised against the app's own scheme before handing it to
 * `parseDeepLink` (which expects a full URL, the same contract `lib/linking.test.ts` already
 * covers). Unknown/malformed input returns `path` unchanged, same fallback `parseDeepLink` itself
 * documents.
 *
 * `resetPassword` carries the association's subdomain in the link itself — forwarded as a
 * `tenant` param so the screen can resolve and set the tenant store before rendering its form
 * ("set tenant from link first", build-plan.md F2.3). `invite` doesn't need this: its target
 * screen derives the tenant from `GET /member-invites/verify`'s own response instead (the
 * server-confirmed association, not a client-supplied param). `paymentsReturn` (F2.8) routes to
 * the payment result screen. `notifications` (F3.x) isn't wired to a screen yet.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'societyledger://').toString();
    const deepLink = parseDeepLink(url);
    if (!deepLink) return path;

    switch (deepLink.type) {
      case 'invite':
        return `/(auth)/accept-invite?token=${encodeURIComponent(deepLink.token)}`;
      case 'resetPassword':
        return `/(auth)/reset-password?token=${encodeURIComponent(deepLink.token)}&tenant=${encodeURIComponent(deepLink.tenant)}`;
      case 'paymentsReturn':
        return `/(app)/(tabs)/money/transaction/${encodeURIComponent(deepLink.reference)}`;
      case 'notifications':
        return path;
      default:
        return path;
    }
  } catch {
    return path;
  }
}
