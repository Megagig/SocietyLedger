/**
 * Where a thrift (Ajo) notification or deep link leads. Pure, so every destination is checked in a test.
 *
 * The API sends `type: 'ajo.…'` and an `entityId` whose meaning depends on the type (a membership, a circle, a payout, a case…).
 * The app only has the id it was given, so a destination that needs a circle the id does not name opens the list instead of guessing.
 * A guarantor's consent link is never routed here: it opens in the browser for everyone.
 */

const MEMBER_HOME = '/(app)/(tabs)/money/thrift';
const STAFF_HOME = '/(app)/(tabs)/manage/thrift';
const COLLECTOR_TODAY = '/(app)/(tabs)/manage/thrift/today';
const NOTIFICATIONS = '/(app)/notifications';

const STAFF_PERMISSIONS = ['ajo.manage', 'ajo.reconcile', 'ajo.approve_payout'];

const has = (permissions: readonly string[], key: string) => permissions.includes(key);
const isStaff = (permissions: readonly string[]) => STAFF_PERMISSIONS.some((key) => has(permissions, key));

/** The screen a push of this type opens for someone holding these permissions. */
export function ajoPushHref(type: string, entityId: number | undefined, permissions: readonly string[]): string {
  const staff = isStaff(permissions);
  const member = has(permissions, 'ajo.view_own');
  const memberOrNotifications = member ? MEMBER_HOME : NOTIFICATIONS;
  const staffOrNotifications = staff ? STAFF_HOME : NOTIFICATIONS;

  switch (type) {
    // A collector is told about the people they gain or lose.
    case 'ajo.collector_assigned':
    case 'ajo.collector_unassigned':
      return has(permissions, 'ajo.collect') ? COLLECTOR_TODAY : NOTIFICATIONS;

    // Default cases name the case, so officers land on it.
    case 'ajo.default_case':
    case 'ajo.plan_missed':
      return staff && entityId ? `${STAFF_HOME}/case/${entityId}` : staffOrNotifications;

    // Payout and dispute events name a payout or claim, not its circle: officers start from the circles list.
    case 'ajo.payout_prepared':
    case 'ajo.payout_approved':
    case 'ajo.payout_voided':
    case 'ajo.payout_reversed':
    case 'ajo.payout_self_approved':
    case 'ajo.dispute_raised':
    case 'ajo.guarantor_accepted':
    case 'ajo.overdue_digest':
    case 'ajo.receipts_waiting':
    case 'ajo.reminders_skipped':
      return staffOrNotifications;

    // A swap is told to the approvers and to the people it involves; the same push, so it follows the person's role.
    case 'ajo.swap_requested':
      return staff ? STAFF_HOME : memberOrNotifications;

    // Being approved names the membership.
    case 'ajo.membership_approved':
      return member && entityId ? `${MEMBER_HOME}/${entityId}` : memberOrNotifications;

    // Everything else is about the person's own circles, payments or account.
    case 'ajo.receipt':
    case 'ajo.reminder':
    case 'ajo.late_fee':
    case 'ajo.rules_changed':
    case 'ajo.verification_status':
    case 'ajo.payout_account_changed':
    case 'ajo.payout_paid':
    case 'ajo.dispute_decided':
    case 'ajo.plan_offered':
    case 'ajo.order_drawn':
    case 'ajo.order_exception':
    case 'ajo.swap_decided':
    case 'ajo.group_started':
    case 'ajo.group_cancelled':
    case 'ajo.group_changed':
    case 'ajo.group_account_changed':
      return memberOrNotifications;

    default:
      return NOTIFICATIONS;
  }
}

/**
 * `societyledger://thrift/…` links: `thrift` is My thrift, `thrift/today` the collector's day, `thrift/circles` the circles list,
 * `thrift/circles/12` one circle, `thrift/12` one of my memberships. Anything else returns null (the caller falls back to Home).
 */
export function thriftDeepLinkPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return MEMBER_HOME;
  const [first, second] = parts;
  if (parts.length === 1 && first === 'today') return COLLECTOR_TODAY;
  if (parts.length === 1 && first === 'circles') return STAFF_HOME;
  if (parts.length === 2 && first === 'circles' && /^\d+$/.test(second ?? '')) return `${STAFF_HOME}/${second}`;
  if (parts.length === 1 && /^\d+$/.test(first ?? '')) return `${MEMBER_HOME}/${first}`;
  return null;
}
