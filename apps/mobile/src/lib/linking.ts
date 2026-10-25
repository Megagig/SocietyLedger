import * as Linking from 'expo-linking';
import { z } from 'zod';

const inviteSchema = z.object({ token: z.string().min(1), tenant: z.string().min(1) });
const resetPasswordSchema = z.object({ token: z.string().min(1), tenant: z.string().min(1) });
const paymentsReturnSchema = z.object({ reference: z.string().min(1), status: z.string().optional() });

export type DeepLink =
  | ({ type: 'invite' } & z.infer<typeof inviteSchema>)
  | ({ type: 'resetPassword' } & z.infer<typeof resetPasswordSchema>)
  | ({ type: 'paymentsReturn' } & z.infer<typeof paymentsReturnSchema>)
  | { type: 'notifications'; route: string };

// `queryParams` values are `string | string[] | undefined` (repeated query keys) — every deep
// link here expects a single scalar value, so arrays/undefined are treated as absent rather than
// coerced, and zod rejects the resulting gap.
function toStringParams(queryParams: Linking.QueryParams | null): Record<string, string> {
  if (!queryParams) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

/**
 * architecture.md §8.3 — parses a `societyledger://...` deep link into a validated, typed shape.
 * Unknown host, unknown shape, or a malformed URL all return `null`; callers route that to Home,
 * per §8.3's own rule, and never read a raw query param past this function.
 *
 * Uses `expo-linking`'s `Linking.parse()`, not the DOM `URL`/`URLSearchParams` API directly —
 * `lib/docs.ts` (F1.6) found those aren't reliably available under Hermes without a polyfill this
 * app doesn't carry; `expo-linking` is the SDK-blessed module for this instead.
 *
 * Only parsing lives here. Wiring this into `+native-intent.tsx` waits until the screens it
 * targets exist — Accept Invite and Reset Password are still unbuilt placeholders here, built
 * for real at F2.3.
 */
export function parseDeepLink(url: string): DeepLink | null {
  const { hostname, path, queryParams } = Linking.parse(url);
  const params = toStringParams(queryParams);

  switch (hostname) {
    case 'invite': {
      const result = inviteSchema.safeParse(params);
      return result.success ? { type: 'invite', ...result.data } : null;
    }
    case 'reset-password': {
      const result = resetPasswordSchema.safeParse(params);
      return result.success ? { type: 'resetPassword', ...result.data } : null;
    }
    case 'payments': {
      if (path !== 'return') return null;
      const result = paymentsReturnSchema.safeParse(params);
      return result.success ? { type: 'paymentsReturn', ...result.data } : null;
    }
    case 'notifications': {
      if (!path) return null;
      return { type: 'notifications', route: path };
    }
    default:
      return null;
  }
}
