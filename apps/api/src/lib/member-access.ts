/**
 * Disabling a member (status `terminated`) also closes their sign-in. Suspended members are not blocked — suspended
 * usually means "behind on dues", and they still need to get in to pay. Editing the status back to active restores access.
 */
export const MEMBER_DISABLED_CODE = 'MEMBER_DISABLED';
export const MEMBER_DISABLED_MESSAGE = 'Your membership has been disabled. Contact your association to get access again.';

export function isMemberDisabled(status: string | null | undefined): boolean {
  return status === 'terminated';
}
