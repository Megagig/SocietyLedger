import { useCan } from '@/hooks/useCan';
import { useSessionStore } from '@/stores/session';
import { AJO_COLLECT_ACCESS, AJO_MEMBER_ACCESS, AJO_STAFF_ACCESS, useAjoStatus, useRotatingCircles } from './queries';

/**
 * Which Ajo entries this person gets on Home, Money and Manage. Entries follow permissions: a contributor sees "My thrift", a
 * collector also sees "Today", an officer also sees the circles. When the add-on is not on the account the entries still show
 * (so people can find out why), and the screen explains it. A standalone thrift group (an account that is only Ajo) is
 * marked `thriftOnly` so the app can trim itself to Ajo.
 */
export function useAjoNav() {
  const member = useCan(AJO_MEMBER_ACCESS);
  const collect = useCan(AJO_COLLECT_ACCESS);
  const staff = useCan(AJO_STAFF_ACCESS);
  const any = member || collect || staff;
  // The same query the gate uses, so asking costs nothing extra once an Ajo screen is open.
  const status = useAjoStatus(any);
  const result = status.data;
  // The session says what kind of account this is from the first screen, so nothing from the association app flashes before the Ajo call answers.
  const sessionKind = useSessionStore((state) => state.user?.tenantKind);
  const thriftOnly = sessionKind === 'THRIFT_GROUP' || (sessionKind === undefined && result?.kind === 'ok' && result.status.tenantKind === 'THRIFT_GROUP');
  // A standalone group gets a Circle tab (the board) when the person is in a rotating pot, or is an officer of one. Asked only then, so nobody else pays for the call.
  const rotating = useRotatingCircles(thriftOnly);
  return {
    member,
    collect,
    staff,
    any,
    /** True only when the account is known not to have Ajo switched on. */
    locked: result?.kind === 'locked',
    /** An account that exists only to run Ajo (a standalone thrift group). */
    thriftOnly,
    /** In at least one rotating pot (spec §16.4): the circles whose board this person can open. */
    circles: rotating.circles,
    /** True until we know what kind of account this is, so a screen can wait instead of flashing association content. */
    resolving: sessionKind === undefined && any && status.isPending,
  };
}
