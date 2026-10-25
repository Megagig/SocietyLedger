import { useSessionStore } from '@/stores/session';

/**
 * The signed-in user's member record id, or `undefined` for an account with no member profile
 * (e.g. an association admin who was never added as a member). Every "my …" endpoint (welfare profile,
 * attendance, voter status, payments) is keyed on it server-side, so screens use this to explain the
 * situation instead of firing requests that can only fail.
 */
export function useMemberId(): number | undefined {
  return useSessionStore((s) => s.user?.member?.id);
}
