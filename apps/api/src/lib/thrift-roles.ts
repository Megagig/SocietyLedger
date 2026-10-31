/**
 * Roles in a standalone thrift group (an account that is only Thrift). It has no cooperatives, welfare, meetings or elections, so:
 *  - its roles carry none of the permissions that belong to those modules (otherwise the administrator, who cannot hold a member's
 *    cooperative or welfare permissions, could never give the Ajo Collector or Ajo Officer role: "you can only give what you hold"), and
 *  - roles that exist only for an association (Treasurer, Financial Secretary, Election Committee) are not offered.
 * The roles themselves are still created, because other code looks them up by name; they are only left out of the list people pick from.
 */
export const THRIFT_GROUP_HIDDEN_ROLES: readonly string[] = ['treasurer', 'financial_secretary', 'election_committee'];

/** Permission prefixes that belong to modules a standalone thrift group does not have. */
export const THRIFT_GROUP_EXCLUDED_PERMISSION_PREFIXES: readonly string[] = ['welfare.', 'cooperatives.'];

export const isThriftExcludedPermission = (key: string): boolean => THRIFT_GROUP_EXCLUDED_PERMISSION_PREFIXES.some((p) => key.startsWith(p));

/** What a role is called to people in a standalone thrift group. Other roles keep their own names. */
export const THRIFT_GROUP_ROLE_NAMES: Record<string, { displayName: string; description: string }> = {
  admin: { displayName: 'Administrator', description: 'Runs the group: circles, people, payments, payouts and settings' },
  ajo_officer: { displayName: 'Officer', description: 'Runs circles day to day and confirms payments, without approving payouts' },
  ajo_collector: { displayName: 'Collector', description: 'Collects contributions from the people assigned to them' },
  member: { displayName: 'Member', description: 'Pays into a circle and sees their own records' },
};
