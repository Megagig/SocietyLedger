/**
 * Permission alias map — copied from `apps/api/src/lib/permissions.ts` (architecture.md §7.4:
 * "a future remap only touches one file"). Mobile gates every permission check by alias name
 * via `can`/`canAny`/`canAll` below (never `user.role === '…'` — code-standards.md/architecture
 * rule #8), checking the real base keys against `permissions: string[]` from login/`/auth/me`.
 *
 * MEETING_MINUTES / MEETING_ATTENDANCE drift (project-overview.md §6.9's known-drift note):
 * confirmed at F1.6 by reading the real, current source — `apps/api/src/lib/permissions.ts`
 * now has dedicated keys (`meetings.manage_minutes`/`meetings.manage_attendance`, seeded and
 * assigned to real roles in `rbac-seed.ts`/`role-permission-mapping.ts`), fixed during Track R's
 * G26. `apps/web/src/lib/permissions.ts` was NOT updated to match (still `members.edit`/
 * `members.view_own`) — a real, currently-live drift between web's UI gating and what the
 * server actually enforces (`meetings.routes.ts`'s `requirePermission(PERMISSIONS.MEETING_*)`
 * calls use the new keys). That's a web bug, out of mobile's scope to fix (architecture.md rule
 * #14) — flagged as a new gap in progress-tracker.md rather than silently left unrecorded.
 * Mobile uses the real, server-enforced values below, per architecture.md §7.4's "API file
 * wins" rule — no `members.edit` fallback compromise needed, since that compromise was based
 * on now-superseded values on both sides.
 */
export const PERMISSIONS = {
  // Member Management
  MEMBER_VIEW: 'members.view',
  MEMBER_VIEW_OWN: 'members.view_own',
  MEMBER_VIEW_ALL: 'members.view_all',
  MEMBER_CREATE: 'members.create',
  MEMBER_EDIT: 'members.edit',
  MEMBER_EDIT_OWN: 'members.edit_own',
  MEMBER_EDIT_ALL: 'members.edit_all',
  MEMBER_DISABLE: 'members.disable',
  MEMBER_BULK_IMPORT: 'members.bulk_import',
  MEMBER_MANAGE_ROLES: 'members.manage_roles',

  // Finance/Ledger
  LEDGER_VIEW: 'ledger.view',
  LEDGER_VIEW_OWN: 'ledger.view_own',
  LEDGER_VIEW_ALL: 'ledger.view_all',
  LEDGER_CREATE: 'ledger.create',
  LEDGER_EDIT: 'ledger.edit',
  LEDGER_REVERSE: 'ledger.reverse',
  LEDGER_EXPORT: 'ledger.export',
  LEDGER_VIEW_MEMBER_STATEMENT: 'ledger.view_member_statement',

  // Payments
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_VIEW_OWN: 'payments.view_own',
  PAYMENTS_VIEW_ALL: 'payments.view_all',
  PAYMENTS_MANUAL_CREATE: 'payments.manual_create',
  PAYMENTS_APPROVE: 'payments.approve',
  PAYMENTS_DELETE: 'payments.delete',

  // Reports
  REPORTS_GENERATE: 'reports.generate',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_FINANCIAL_SUMMARY: 'reports.financial_summary',

  // Roles & Permissions
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT: 'roles.edit',
  ROLES_ASSIGN: 'roles.assign',
  PERMISSIONS_MANAGE: 'permissions.manage',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_BILLING: 'settings.billing',
  SETTINGS_INTEGRATIONS: 'settings.integrations',

  // Audit
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // Legacy Member Management
  MEMBER_DELETE: 'members.disable',
  MEMBER_EXPORT: 'ledger.export',

  // Legacy Financial Management
  FINANCE_VIEW: 'ledger.view',
  FINANCE_CREATE: 'ledger.create',
  FINANCE_EDIT: 'ledger.edit',
  FINANCE_DELETE: 'ledger.reverse',
  FINANCE_APPROVE: 'payments.approve',

  // Legacy Transaction Management
  TRANSACTION_VIEW: 'ledger.view',
  TRANSACTION_CREATE: 'ledger.create',
  TRANSACTION_EDIT: 'ledger.edit',
  TRANSACTION_DELETE: 'ledger.reverse',
  TRANSACTION_CONFIRM: 'payments.approve',

  // Legacy Payment Management
  PAYMENT_VIEW: 'payments.view',
  PAYMENT_CREATE: 'payments.manual_create',
  PAYMENT_CONFIRM: 'payments.approve',

  // Legacy Report Access
  REPORT_VIEW: 'reports.generate',
  REPORT_FINANCIAL: 'reports.financial_summary',
  REPORT_MEMBER: 'reports.generate',
  REPORT_EXPORT: 'reports.export',

  // Legacy User Management
  USER_VIEW: 'members.view_all',
  USER_CREATE: 'members.create',
  USER_EDIT: 'members.edit_all',
  USER_DELETE: 'members.disable',
  USER_APPROVE: 'members.manage_roles',

  // Legacy Association Management
  ASSOCIATION_VIEW: 'settings.view',
  ASSOCIATION_EDIT: 'settings.edit',
  ASSOCIATION_SETTINGS: 'settings.edit',

  // Legacy Subscription Management
  SUBSCRIPTION_VIEW: 'settings.view',
  SUBSCRIPTION_MANAGE: 'settings.billing',

  // Legacy System Settings
  SYSTEM_SETTINGS_MANAGE: 'settings.edit',

  // Cooperative Management
  COOPERATIVE_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_MANAGE: 'ledger.create',
  COOPERATIVE_LOANS_VIEW: 'ledger.view',
  COOPERATIVE_LOANS_APPLY: 'ledger.create',
  COOPERATIVE_LOANS_MANAGE: 'payments.approve',
  COOPERATIVE_GUARANTOR: 'ledger.view',

  // Member-own cooperatives keys (apps/api/src/lib/permissions.ts) — members hold these, not ledger.*.
  COOPERATIVE_VIEW_OWN: 'cooperatives.view_own',
  COOPERATIVE_APPLY_OWN: 'cooperatives.apply_own',
  COOPERATIVE_GUARANTOR_OWN: 'cooperatives.guarantor_own',
  COOPERATIVE_SAVINGS_DEPOSIT_OWN: 'cooperatives.savings_deposit_own',
  COOPERATIVE_REPAY_OWN: 'cooperatives.repay_own',

  // Member Self-Service Finance
  MEMBER_FINANCE_VIEW: 'ledger.view_own',

  // Meeting Management — see the module-level note above for MEETING_MINUTES/MEETING_ATTENDANCE
  MEETING_VIEW: 'members.view_own',
  MEETING_CREATE: 'members.create',
  MEETING_EDIT: 'members.edit',
  MEETING_DELETE: 'members.disable',
  MEETING_ATTENDANCE: 'meetings.manage_attendance',
  MEETING_MINUTES: 'meetings.manage_minutes',

  // Welfare & Social Funds
  WELFARE_VIEW: 'ledger.view',
  WELFARE_MANAGE: 'ledger.create',
  WELFARE_CONTRIBUTION_VIEW: 'ledger.view',
  WELFARE_CONTRIBUTION_MANAGE: 'ledger.create',
  WELFARE_CONTRIBUTION_CONFIRM: 'payments.approve',
  WELFARE_PAYOUT_VIEW: 'ledger.view',
  WELFARE_PAYOUT_REQUEST: 'ledger.create',
  WELFARE_PAYOUT_APPROVE: 'payments.approve',
  WELFARE_PAYOUT_DISBURSE: 'payments.approve',
  // Member self-service (own record only) — what the `member` role actually holds; the ledger.* keys above are officer-level.
  WELFARE_VIEW_OWN: 'welfare.view_own',
  WELFARE_REQUEST_OWN: 'welfare.request_own',

  // SMS & Bulk Communication
  SMS_VIEW: 'communication.sms.view',
  SMS_SEND: 'communication.sms.send',
  SMS_CAMPAIGN_MANAGE: 'communication.sms.campaign',
  SMS_TEMPLATE_MANAGE: 'communication.sms.template',
  SMS_CREDIT_MANAGE: 'settings.billing',

  // Nigerian Payments Management
  PAYMENT_RECORD: 'payments.nigerian.record',
  PAYMENT_VERIFY: 'payments.nigerian.verify',
  PAYMENT_RECONCILE: 'payments.nigerian.reconcile',
  PAYMENT_IMPORT: 'payments.nigerian.import',
  NIGERIAN_PAYMENTS_VIEW: 'payments.nigerian.view',

  // Notifications & Announcements
  NOTIFICATION_VIEW: 'notifications.view',
  NOTIFICATION_SEND: 'notifications.send',

  // Exports Management
  EXPORT_FINANCIAL: 'exports.financial',
  EXPORT_MEMBERS: 'exports.members',
  EXPORT_VIEW_HISTORY: 'exports.view_history',

  // AI Integration
  AI_VIEW: 'reports.generate',
  AI_FINANCIAL_ASSISTANT: 'reports.financial_summary',
  AI_REPORTS: 'reports.generate',
  AI_QUERY: 'reports.generate',
  AI_USAGE_VIEW: 'audit.view',

  // Voting & Elections
  ELECTION_VIEW: 'elections.view_own',
  ELECTION_MANAGE: 'members.create',
  ELECTION_NOMINATE: 'elections.nominate_own',
  ELECTION_VOTE: 'elections.vote_own',
  POLL_VIEW: 'polls.view_own',
  POLL_MANAGE: 'members.create',
  POLL_VOTE: 'polls.vote_own',

  // Help & Support
  HELP_VIEW: 'help.view',
  HELP_MANAGE: 'help.manage',
  SUPPORT_CREATE: 'support.create',
  SUPPORT_VIEW_OWN: 'support.view_own',
  SUPPORT_VIEW_ALL: 'support.view_all',
  SUPPORT_MANAGE: 'support.manage',
  SUPPORT_RESPOND: 'support.respond',
} as const;

export type PermissionAlias = keyof typeof PERMISSIONS;

/**
 * project-overview.md §5.1 + §6.9 — the Manage tab itself is shown if the user holds at least one
 * permission that unlocks any Manage section. One alias per section is enough (several sections
 * share the same base key, e.g. `ledger.view` — `canAny` only needs one true to short-circuit),
 * picked from §6.9's own "visible if" column: Members, Finance, Payments verification, Reports &
 * Exports, Meetings admin, Elections/Polls admin, Welfare admin, Communication, Settings, Support.
 * Module-gated sections (Accounting, AI Assistant, Cooperatives admin) need a module check too —
 * that's `stores/modules`, not this list, so they're deliberately left out here.
 */
export const MANAGE_TAB_PERMISSIONS: PermissionAlias[] = [
  'MEMBER_VIEW',
  'MEMBER_VIEW_ALL',
  'LEDGER_VIEW',
  'NIGERIAN_PAYMENTS_VIEW',
  'PAYMENT_VERIFY',
  'REPORTS_GENERATE',
  'REPORTS_FINANCIAL_SUMMARY',
  'REPORTS_EXPORT',
  'MEETING_CREATE',
  'MEETING_EDIT',
  'ELECTION_MANAGE',
  'POLL_MANAGE',
  'WELFARE_MANAGE',
  'WELFARE_PAYOUT_APPROVE',
  'SMS_VIEW',
  'NOTIFICATION_SEND',
  'SETTINGS_VIEW',
  'ROLES_VIEW',
  'AUDIT_VIEW',
  'SUPPORT_VIEW_ALL',
];

/** Checks a single alias against the user's real permission list. */
export function can(permissions: string[], alias: PermissionAlias): boolean {
  return permissions.includes(PERMISSIONS[alias]);
}

/** True if the user has at least one of the given aliases. */
export function canAny(permissions: string[], aliases: PermissionAlias[]): boolean {
  return aliases.some((alias) => can(permissions, alias));
}

/** True if the user has every one of the given aliases. */
export function canAll(permissions: string[], aliases: PermissionAlias[]): boolean {
  return aliases.every((alias) => can(permissions, alias));
}

/** Seeing own savings: members via cooperatives.view_own, officers via ledger.view. */
export const COOPERATIVE_SAVINGS_VIEW_ACCESS: PermissionAlias[] = ['COOPERATIVE_VIEW_OWN', 'COOPERATIVE_SAVINGS_VIEW'];
/** Seeing own loans and applications: members via cooperatives.view_own, officers via ledger.view. */
export const COOPERATIVE_LOANS_VIEW_ACCESS: PermissionAlias[] = ['COOPERATIVE_VIEW_OWN', 'COOPERATIVE_LOANS_VIEW'];
/** Applying for a loan — the API accepts the officer key or cooperatives.apply_own. */
export const COOPERATIVE_LOANS_APPLY_ACCESS: PermissionAlias[] = ['COOPERATIVE_APPLY_OWN', 'COOPERATIVE_LOANS_APPLY'];
/** Declaring a loan payment with a receipt — the API gates POST /cooperatives/loan-repayment-requests on this one key only. */
export const COOPERATIVE_LOAN_REPAY_ACCESS: PermissionAlias = 'COOPERATIVE_REPAY_OWN';
/** Declaring a deposit with a receipt — the API gates POST /cooperatives/savings-deposits on this one key only. */
export const COOPERATIVE_SAVINGS_DEPOSIT_ACCESS: PermissionAlias = 'COOPERATIVE_SAVINGS_DEPOSIT_OWN';

/** Seeing welfare: officers via ledger.view, members via welfare.view_own. */
export const WELFARE_VIEW_ACCESS: PermissionAlias[] = ['WELFARE_VIEW', 'WELFARE_VIEW_OWN'];
/** Filing a welfare request: officers via ledger.create, members via welfare.request_own. */
export const WELFARE_REQUEST_ACCESS: PermissionAlias[] = ['WELFARE_PAYOUT_REQUEST', 'WELFARE_REQUEST_OWN'];
