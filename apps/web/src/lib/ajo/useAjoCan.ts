'use client';

import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

type AjoPermission = 'MANAGE' | 'RECONCILE' | 'APPROVE_PAYOUT' | 'COLLECT' | 'VIEW_OWN' | 'REPORTS';

const KEY = {
  MANAGE: PERMISSIONS.AJO_MANAGE,
  RECONCILE: PERMISSIONS.AJO_RECONCILE,
  APPROVE_PAYOUT: PERMISSIONS.AJO_APPROVE_PAYOUT,
  COLLECT: PERMISSIONS.AJO_COLLECT,
  VIEW_OWN: PERMISSIONS.AJO_VIEW_OWN,
  REPORTS: PERMISSIONS.AJO_REPORTS,
} as const;

/**
 * What the signed-in person may do in Ajo, for deciding which buttons and tabs to draw. The server checks every request again, so this
 * only keeps the screen honest: a control the person cannot use is not shown.
 */
export function useAjoCan() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];
  const can = (p: AjoPermission) => hasPermission(permissions, KEY[p]);
  return {
    can,
    manage: can('MANAGE'),
    reconcile: can('RECONCILE'),
    approvePayout: can('APPROVE_PAYOUT'),
    collect: can('COLLECT'),
    anyOfficer: can('MANAGE') || can('RECONCILE') || can('APPROVE_PAYOUT'),
  };
}
