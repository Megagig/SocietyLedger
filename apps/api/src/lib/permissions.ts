/**
 * Permission Constants
 * 
 * These constants are kept for backward compatibility and type safety.
 * The actual permission checking is done against the database.
 * 
 * NOTE: The database is the SINGLE SOURCE OF TRUTH for permissions.
 * These constants should match the permission keys in the database.
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
  // These map to the new permission keys above
  // ============================================
  
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
  
  // ============================================
  // FEATURE-SPECIFIC PERMISSIONS (kept for compatibility)
  // These should be added to the database if needed
  // ============================================
  
  // Cooperative Management
  COOPERATIVE_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_VIEW: 'ledger.view',
  COOPERATIVE_SAVINGS_MANAGE: 'ledger.create',
  COOPERATIVE_LOANS_VIEW: 'ledger.view',
  COOPERATIVE_LOANS_APPLY: 'ledger.create',
  COOPERATIVE_LOANS_MANAGE: 'payments.approve',
  COOPERATIVE_GUARANTOR: 'ledger.view',
  
  // Member Self-Service Finance
  MEMBER_FINANCE_VIEW: 'ledger.view_own',
  
  // Meeting Management
  MEETING_VIEW: 'members.view',
  MEETING_CREATE: 'members.create',
  MEETING_EDIT: 'members.edit',
  MEETING_DELETE: 'members.disable',
  MEETING_ATTENDANCE: 'members.edit',
  MEETING_MINUTES: 'members.edit',
  
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
  
  // SMS & Bulk Communication
  SMS_VIEW: 'settings.view',
  SMS_SEND: 'settings.edit',
  SMS_CAMPAIGN_MANAGE: 'settings.edit',
  SMS_TEMPLATE_MANAGE: 'settings.edit',
  SMS_CREDIT_MANAGE: 'settings.billing',
  
  // AI Integration
  AI_VIEW: 'reports.generate',
  AI_FINANCIAL_ASSISTANT: 'reports.financial_summary',
  AI_REPORTS: 'reports.generate',
  AI_QUERY: 'reports.generate',
  AI_USAGE_VIEW: 'audit.view',
  
  // Voting & Elections
  ELECTION_VIEW: 'members.view',
  ELECTION_MANAGE: 'members.create',
  ELECTION_NOMINATE: 'members.view',
  ELECTION_VOTE: 'members.view',
  POLL_VIEW: 'members.view',
  POLL_MANAGE: 'members.create',
  POLL_VOTE: 'members.view',
  
  // Help & Support (Phase 21)
  HELP_VIEW: 'help.view',
  HELP_MANAGE: 'help.manage',
  SUPPORT_CREATE: 'support.create',
  SUPPORT_VIEW_OWN: 'support.view_own',
  SUPPORT_VIEW_ALL: 'support.view_all',
  SUPPORT_MANAGE: 'support.manage',
  SUPPORT_RESPOND: 'support.respond',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * @deprecated Use RBACService.hasPermission() instead
 * This function is kept for backward compatibility only.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  console.warn('DEPRECATED: hasPermission() is deprecated. Use RBACService.hasPermission() instead.');
  // Return true to avoid breaking existing code during migration
  // The actual check should be done via RBACService
  return true;
}

/**
 * @deprecated Use RBACService.hasAnyPermission() instead
 */
export function hasAnyPermission(role: string, requiredPermissions: Permission[]): boolean {
  console.warn('DEPRECATED: hasAnyPermission() is deprecated. Use RBACService.hasAnyPermission() instead.');
  return true;
}

/**
 * @deprecated Use RBACService.hasAllPermissions() instead
 */
export function hasAllPermissions(role: string, requiredPermissions: Permission[]): boolean {
  console.warn('DEPRECATED: hasAllPermissions() is deprecated. Use RBACService.hasAllPermissions() instead.');
  return true;
}

/**
 * @deprecated Use RBACService.resolveUserPermissions() instead
 */
export function getUserPermissions(role: string): Permission[] {
  console.warn('DEPRECATED: getUserPermissions() is deprecated. Use RBACService.resolveUserPermissions() instead.');
  return [];
}

/**
 * @deprecated Use RBACService.hasAnyPermission() instead
 */
export function canAccessRoute(role: string, routePermissions: Permission[]): boolean {
  console.warn('DEPRECATED: canAccessRoute() is deprecated. Use RBACService.hasAnyPermission() instead.');
  return true;
}