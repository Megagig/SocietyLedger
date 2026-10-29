import { useCan } from '@/hooks/useCan';
import { AJO_COLLECT_ACCESS, AJO_MEMBER_ACCESS, AJO_STAFF_ACCESS, useAjoStatus } from './queries';

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
  return {
    member,
    collect,
    staff,
    any,
    /** True only when the account is known not to have Ajo switched on. */
    locked: result?.kind === 'locked',
    /** An account that exists only to run Ajo (a standalone thrift group). */
    thriftOnly: result?.kind === 'ok' && result.status.tenantKind === 'THRIFT_GROUP',
    /** True until we know what kind of account this is, so a screen can wait instead of flashing association content. */
    resolving: any && status.isPending,
  };
}
