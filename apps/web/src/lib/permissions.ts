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
  SUBSCRIPTION_VIEW: 'settings.view',
  SUBSCRIPTION_MANAGE: 'settings.billing',
  
  // Feature-specific (mapped to core permissions)
  COOPERATIVE_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_MANAGE: 'ledger.create',
  COOPERATIVE_LOANS_VIEW: 'ledger.view',
  COOPERATIVE_LOANS_APPLY: 'ledger.create',
  COOPERATIVE_LOANS_MANAGE: 'payments.approve',
  COOPERATIVE_GUARANTOR: 'ledger.view',
  MEMBER_FINANCE_VIEW: 'ledger.view_own',
  MEETING_VIEW: 'members.view',
  MEETING_CREATE: 'members.create',
  MEETING_EDIT: 'members.edit',
  MEETING_DELETE: 'members.disable',
  MEETING_ATTENDANCE: 'members.edit',
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
  SMS_VIEW: 'settings.view',
  SMS_SEND: 'settings.edit',
  SMS_CAMPAIGN_MANAGE: 'settings.edit',
  SMS_TEMPLATE_MANAGE: 'settings.edit',
  SMS_CREDIT_MANAGE: 'settings.billing',
  AI_VIEW: 'reports.generate',
  AI_FINANCIAL_ASSISTANT: 'reports.financial_summary',
  AI_REPORTS: 'reports.generate',
  AI_QUERY: 'reports.generate',
  AI_USAGE_VIEW: 'audit.view',
  ELECTION_VIEW: 'members.view',
  ELECTION_MANAGE: 'members.create',
  ELECTION_NOMINATE: 'members.view',
  ELECTION_VOTE: 'members.view',
  POLL_VIEW: 'members.view',
  POLL_MANAGE: 'members.create',
  POLL_VOTE: 'members.view',
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

export function isMember(role: string): boolean {
  return role === 'member';
}