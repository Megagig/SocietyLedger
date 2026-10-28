'use client';

import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS, hasAnyPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { ajoApi } from './api';
import { ajoKeys } from './hooks';

/** The menu entries a standalone thrift group keeps. It runs only Ajo, so everything else is left out, apart from what it needs to run and pay. */
export const THRIFT_ONLY_ADMIN_LABELS = ['Thrift Groups', 'Collect', 'Members', 'Notifications', 'Subscription', 'Settings', 'Help & Support'];
export const THRIFT_ONLY_MEMBER_LABELS = ['My Thrift', 'My Profile'];

/**
 * Which Ajo menu entries this person gets, for both sidebars. Entries follow permissions, so a member sees only "My Thrift", a collector
 * also sees "Collect", an officer also sees the groups, and someone who is several of these sees all of them. When the add-on is not
 * on the account the entries still show (so people can find out why), marked "Locked"; the page itself explains it.
 * A standalone thrift group (an account that is only Ajo) also gets a menu trimmed to Ajo.
 */
export function useAjoNav() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];
  const member = hasAnyPermission(permissions, [PERMISSIONS.AJO_VIEW_OWN]);
  const collect = hasAnyPermission(permissions, [PERMISSIONS.AJO_COLLECT]);
  const staff = hasAnyPermission(permissions, [PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_RECONCILE, PERMISSIONS.AJO_APPROVE_PAYOUT]);
  // The same query the Ajo pages use, so asking costs nothing extra once they are open.
  const status = useQuery({ queryKey: ajoKeys.status(), queryFn: ajoApi.status, staleTime: 30_000, retry: false, enabled: member || collect || staff });
  const result = status.data;
  return {
    member,
    collect,
    staff,
    /** True only when the account is known not to have Ajo switched on. */
    locked: result?.kind === 'locked',
    /** An account that exists only to run Ajo (a standalone thrift group). */
    thriftOnly: result?.kind === 'ok' && result.status.tenantKind === 'THRIFT_GROUP',
  };
}
