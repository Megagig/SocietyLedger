/**
 * Permission Constants for Frontend
 * 
 * These constants are used for type safety and as permission keys.
 * The actual permission checking is done against user permissions
 * fetched from the API (which reads from the database).
 * 
 * NOTE: The database is the SINGLE SOURCE OF TRUTH for permissions.
 */

// Permission key constants - must match database permission keys
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
  
  // Help & Support (Phase 21)
  HELP_VIEW: 'help.view',
  HELP_MANAGE: 'help.manage',
  SUPPORT_CREATE: 'support.create',
  SUPPORT_VIEW_OWN: 'support.view_own',
  SUPPORT_VIEW_ALL: 'support.view_all',
  SUPPORT_MANAGE: 'support.manage',
  SUPPORT_RESPOND: 'support.respond',
  SUPPORT_ESCALATE: 'support.escalate',
  
  // Nigerian Payments Management (Phase 3.6)
  PAYMENT_RECORD: 'payments.nigerian.record',
  PAYMENT_VERIFY: 'payments.nigerian.verify',
  PAYMENT_RECONCILE: 'payments.nigerian.reconcile',
  PAYMENT_IMPORT: 'payments.nigerian.import',
  NIGERIAN_PAYMENTS_VIEW: 'payments.nigerian.view',
  
  // Cash collections & lodgments
  CASH_COLLECT: 'cash.collect',
  CASH_LODGE: 'cash.lodge',
  CASH_VERIFY: 'cash.verify',
  CASH_VIEW: 'cash.view',
  
  // SMS & Communications (Phase 6.6)
  SMS_VIEW: 'communication.sms.view',
  SMS_SEND: 'communication.sms.send',
  SMS_CAMPAIGN_MANAGE: 'communication.sms.campaign',
  SMS_TEMPLATE_MANAGE: 'communication.sms.template',
  SMS_CREDIT_MANAGE: 'settings.billing',
  
  // Notifications & Announcements (Phase 6.7)
  NOTIFICATION_VIEW: 'notifications.view',
  NOTIFICATION_SEND: 'notifications.send',
  
  // Exports Management (Phase 10.5)
  EXPORT_FINANCIAL: 'exports.financial',
  EXPORT_MEMBERS: 'exports.members',
  EXPORT_VIEW_HISTORY: 'exports.view_history',
  
  // Cron Jobs & System (Phase 15)
  CRON_VIEW: 'system.cron.view',
  CRON_TRIGGER: 'system.cron.trigger',
  SYSTEM_SETTINGS_MANAGE: 'settings.edit',
  
  // ============================================
  // LEGACY PERMISSION KEYS (for backward compatibility)
  // ============================================
  
  MEMBER_DELETE: 'members.disable',
  MEMBER_EXPORT: 'ledger.export',
  FINANCE_VIEW: 'ledger.view',
  FINANCE_CREATE: 'ledger.create',
  FINANCE_EDIT: 'ledger.edit',
  FINANCE_DELETE: 'ledger.reverse',
  FINANCE_APPROVE: 'payments.approve',
  TRANSACTION_VIEW: 'ledger.view',
  TRANSACTION_CREATE: 'ledger.create',
  TRANSACTION_EDIT: 'ledger.edit',
  TRANSACTION_DELETE: 'ledger.reverse',
  TRANSACTION_CONFIRM: 'payments.approve',
  PAYMENT_VIEW: 'payments.view',
  PAYMENT_CREATE: 'payments.manual_create',
  PAYMENT_CONFIRM: 'payments.approve',
  REPORT_VIEW: 'reports.generate',
  REPORT_FINANCIAL: 'reports.financial_summary',
  REPORT_MEMBER: 'reports.generate',
  REPORT_EXPORT: 'reports.export',
  USER_VIEW: 'members.view_all',
  USER_CREATE: 'members.create',
  USER_EDIT: 'members.edit_all',
  USER_DELETE: 'members.disable',
  USER_APPROVE: 'members.manage_roles',
  ASSOCIATION_VIEW: 'settings.view',
  ASSOCIATION_EDIT: 'settings.edit',
  ASSOCIATION_SETTINGS: 'settings.edit',
  SUBSCRIPTION_VIEW: 'members.view_own', // Members can view their subscription
  SUBSCRIPTION_MANAGE: 'settings.billing',
  
  // Feature-specific (mapped to core permissions)
  COOPERATIVE_VIEW: 'ledger.view_own', // Members view their own cooperative data
  COOPERATIVE_SAVINGS_VIEW: 'ledger.view_own', // Members view their own savings
  COOPERATIVE_SAVINGS_MANAGE: 'ledger.create', // Officers manage all savings — same key the API enforces (apps/api/src/lib/permissions.ts); admin, treasurer, financial secretary
  COOPERATIVE_LOANS_VIEW: 'ledger.view_own', // Members view their own loans
  COOPERATIVE_LOANS_APPLY: 'members.view_own', // Members can apply for loans
  COOPERATIVE_LOANS_MANAGE: 'payments.approve', // Admin manages loan applications
  COOPERATIVE_GUARANTOR: 'members.view_own', // Members can see guarantor requests
  COOPERATIVE_SAVINGS_DEPOSIT_OWN: 'cooperatives.savings_deposit_own', // Declare a savings deposit with a receipt
  COOPERATIVE_REPAY_OWN: 'cooperatives.repay_own', // Declare a payment towards your own loan with a receipt
  MEMBER_FINANCE_VIEW: 'ledger.view_own',
  MEETING_VIEW: 'members.view_own', // Members can view meetings
  MEETING_CREATE: 'members.create',
  MEETING_EDIT: 'members.edit',
  MEETING_DELETE: 'members.disable',
  MEETING_ATTENDANCE: 'members.view_own', // Members can mark attendance
  MEETING_MINUTES: 'members.edit',
  WELFARE_VIEW: 'ledger.view',
  WELFARE_MANAGE: 'ledger.create',
  WELFARE_CONTRIBUTION_VIEW: 'ledger.view',
  WELFARE_CONTRIBUTION_MANAGE: 'ledger.create',
  WELFARE_CONTRIBUTION_CONFIRM: 'payments.approve',
  WELFARE_PAYOUT_VIEW: 'ledger.view',
  WELFARE_PAYOUT_REQUEST: 'ledger.create',
  WELFARE_PAYOUT_APPROVE: 'payments.approve',
  WELFARE_PAYOUT_DISBURSE: 'payments.approve',
  AI_VIEW: 'reports.generate',
  AI_FINANCIAL_ASSISTANT: 'reports.financial_summary',
  AI_REPORTS: 'reports.generate',
  AI_QUERY: 'reports.generate',
  AI_USAGE_VIEW: 'audit.view',
  ELECTION_VIEW: 'members.view_own', // Members can view and participate in elections
  ELECTION_MANAGE: 'elections.manage',
  ELECTION_CANDIDATES: 'elections.candidates.manage',
  ELECTION_RUN: 'elections.run',
  ELECTION_RESULTS_VIEW: 'elections.results.view',
  ELECTION_RESULTS_PUBLISH: 'elections.results.publish',
  ELECTION_NOMINATE: 'members.view_own', // Members can nominate
  ELECTION_VOTE: 'members.view_own', // Members can vote
  POLL_VIEW: 'members.view_own', // Members can view and participate in polls
  POLL_MANAGE: 'polls.manage',
  POLL_VOTE: 'members.view_own', // Members can vote in polls
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Check if user has a specific permission
 * Uses the permissions array from the auth store (fetched from API)
 */
export function hasPermission(userPermissions: string[] | undefined, permission: Permission | string): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: string[] | undefined, requiredPermissions: (Permission | string)[]): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return requiredPermissions.some(p => userPermissions.includes(p));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userPermissions: string[] | undefined, requiredPermissions: (Permission | string)[]): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return requiredPermissions.every(p => userPermissions.includes(p));
}

/**
 * Role checking helpers (for backward compatibility)
 * These check the role name, not permissions
 */
export function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdmin(platformRole: string | null | undefined): boolean {
  return platformRole === 'SUPER_ADMIN';
}

export function isTreasurer(role: string): boolean {
  return role === 'treasurer';
}

export function isFinancialSecretary(role: string): boolean {
  return role === 'financial_secretary';
}

/**
 * Whether someone gets the officer dashboard. `GET /dashboard/overview` needs `ledger.view`, so the roles that normally get it are
 * only officers if they also hold that permission; anyone else (members, the Election Committee, custom roles) gets the member dashboard.
 * A user whose permission list hasn't loaded yet is judged by role alone.
 */
export function canSeeOfficerDashboard(user: { role: string; permissions?: string[] } | null | undefined): boolean {
  if (!user || !['admin', 'treasurer', 'financial_secretary'].includes(user.role)) return false;
  return user.permissions === undefined || user.permissions.includes(PERMISSIONS.LEDGER_VIEW);
}

export function isMember(role: string): boolean {
  return role === 'member';
}