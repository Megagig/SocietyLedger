/**
 * Can the circle be started yet? The server decides and refuses a start with nobody approved (`NOT_ENOUGH_PARTICIPANTS`); this lets the
 * screen say so before the person presses a button that cannot work, and send them to where they fix it. Pure, so it is tested.
 */
export type StartReadiness = { canStart: true } | { canStart: false; reason: string; fix: 'MEMBERS' };

export function startReadiness(activeParticipants: number): StartReadiness {
  if (activeParticipants <= 0) {
    return { canStart: false, fix: 'MEMBERS', reason: 'Nobody is approved yet. Approve at least one person on Members, then start the circle.' };
  }
  return { canStart: true };
}
