// Permission constants for frontend (matches backend)
export const PERMISSIONS = {
  // Member Management
  MEMBER_VIEW: 'member:view',
  MEMBER_CREATE: 'member:create',
  MEMBER_EDIT: 'member:edit',
  MEMBER_DELETE: 'member:delete',
  MEMBER_EXPORT: 'member:export',
  
  // Financial Management
  FINANCE_VIEW: 'finance:view',
  FINANCE_CREATE: 'finance:create',
  FINANCE_EDIT: 'finance:edit',
  FINANCE_DELETE: 'finance:delete',
  FINANCE_APPROVE: 'finance:approve',
  
  // Transaction Management
  TRANSACTION_VIEW: 'transaction:view',
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_EDIT: 'transaction:edit',
  TRANSACTION_DELETE: 'transaction:delete',
  TRANSACTION_CONFIRM: 'transaction:confirm',
  
  // Payment Management
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_CONFIRM: 'payment:confirm',
  
  // Report Access
  REPORT_VIEW: 'report:view',
  REPORT_FINANCIAL: 'report:financial',
  REPORT_MEMBER: 'report:member',
  REPORT_EXPORT: 'report:export',
  
  // Settings Management
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  
  // User Management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_APPROVE: 'user:approve',
  
  // Association Management
  ASSOCIATION_VIEW: 'association:view',
  ASSOCIATION_EDIT: 'association:edit',
  ASSOCIATION_SETTINGS: 'association:settings',
  
  // Subscription Management
  SUBSCRIPTION_VIEW: 'subscription:view',
  SUBSCRIPTION_MANAGE: 'subscription:manage',
  
  // Audit Logs
  AUDIT_VIEW: 'audit:view',
  
  // Cooperative Management (Phase 8.5)
  COOPERATIVE_VIEW: 'cooperative:view',           // View cooperative dashboard & own data
  COOPERATIVE_SAVINGS_VIEW: 'cooperative:savings:view',    // View savings accounts
  COOPERATIVE_SAVINGS_MANAGE: 'cooperative:savings:manage', // Create accounts, process transactions
  COOPERATIVE_LOANS_VIEW: 'cooperative:loans:view',        // View loans
  COOPERATIVE_LOANS_APPLY: 'cooperative:loans:apply',      // Apply for loans
  COOPERATIVE_LOANS_MANAGE: 'cooperative:loans:manage',    // Approve, disburse loans
  COOPERATIVE_GUARANTOR: 'cooperative:guarantor',          // Act as guarantor
  
  // Member Self-Service Finance
  MEMBER_FINANCE_VIEW: 'member:finance:view',     // View own financial data (dues, levies, etc.)
  
  // Meeting Management (Phase 12.5)
  MEETING_VIEW: 'meeting:view',           // View meetings
  MEETING_CREATE: 'meeting:create',       // Create/schedule meetings
  MEETING_EDIT: 'meeting:edit',           // Edit meeting details
  MEETING_DELETE: 'meeting:delete',       // Cancel/delete meetings
  MEETING_ATTENDANCE: 'meeting:attendance', // Mark attendance
  MEETING_MINUTES: 'meeting:minutes',     // Record/approve minutes
  
  // Welfare & Social Funds (Phase 5.5)
  WELFARE_VIEW: 'welfare:view',                           // View welfare dashboard & funds
  WELFARE_MANAGE: 'welfare:manage',                       // Create/edit/delete welfare funds
  WELFARE_CONTRIBUTION_VIEW: 'welfare:contribution:view', // View contributions
  WELFARE_CONTRIBUTION_MANAGE: 'welfare:contribution:manage', // Record contributions
  WELFARE_CONTRIBUTION_CONFIRM: 'welfare:contribution:confirm', // Confirm/reject contributions
  WELFARE_PAYOUT_VIEW: 'welfare:payout:view',             // View payout requests
  WELFARE_PAYOUT_REQUEST: 'welfare:payout:request',       // Request payouts
  WELFARE_PAYOUT_APPROVE: 'welfare:payout:approve',       // Approve/reject payout requests
  WELFARE_PAYOUT_DISBURSE: 'welfare:payout:disburse',     // Disburse approved payouts
  
  // SMS & Bulk Communication (Phase 6.5)
  SMS_VIEW: 'sms:view',                     // View SMS dashboard, messages, history
  SMS_SEND: 'sms:send',                     // Send quick SMS messages
  SMS_CAMPAIGN_MANAGE: 'sms:campaign:manage', // Create, edit, execute campaigns
  SMS_TEMPLATE_MANAGE: 'sms:template:manage', // Create, edit, delete templates
  SMS_CREDIT_MANAGE: 'sms:credit:manage',   // Top up and manage SMS credits
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role to Permissions mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  
  admin: [
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_CREATE,
    PERMISSIONS.MEMBER_EDIT,
    PERMISSIONS.MEMBER_DELETE,
    PERMISSIONS.MEMBER_EXPORT,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_CREATE,
    PERMISSIONS.FINANCE_EDIT,
    PERMISSIONS.FINANCE_DELETE,
    PERMISSIONS.FINANCE_APPROVE,
    PERMISSIONS.TRANSACTION_VIEW,
    PERMISSIONS.TRANSACTION_CREATE,
    PERMISSIONS.TRANSACTION_EDIT,
    PERMISSIONS.TRANSACTION_DELETE,
    PERMISSIONS.TRANSACTION_CONFIRM,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_CONFIRM,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_FINANCIAL,
    PERMISSIONS.REPORT_MEMBER,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_APPROVE,
    PERMISSIONS.ASSOCIATION_VIEW,
    PERMISSIONS.ASSOCIATION_EDIT,
    PERMISSIONS.ASSOCIATION_SETTINGS,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    
    // Cooperative - Full management
    PERMISSIONS.COOPERATIVE_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE,
    PERMISSIONS.COOPERATIVE_LOANS_VIEW,
    PERMISSIONS.COOPERATIVE_LOANS_APPLY,
    PERMISSIONS.COOPERATIVE_LOANS_MANAGE,
    PERMISSIONS.COOPERATIVE_GUARANTOR,
    
    // Meetings - Full management
    PERMISSIONS.MEETING_VIEW,
    PERMISSIONS.MEETING_CREATE,
    PERMISSIONS.MEETING_EDIT,
    PERMISSIONS.MEETING_DELETE,
    PERMISSIONS.MEETING_ATTENDANCE,
    PERMISSIONS.MEETING_MINUTES,
    
    // Welfare - Full management
    PERMISSIONS.WELFARE_VIEW,
    PERMISSIONS.WELFARE_MANAGE,
    PERMISSIONS.WELFARE_CONTRIBUTION_VIEW,
    PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE,
    PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM,
    PERMISSIONS.WELFARE_PAYOUT_VIEW,
    PERMISSIONS.WELFARE_PAYOUT_REQUEST,
    PERMISSIONS.WELFARE_PAYOUT_APPROVE,
    PERMISSIONS.WELFARE_PAYOUT_DISBURSE,
    
    // SMS - Full management
    PERMISSIONS.SMS_VIEW,
    PERMISSIONS.SMS_SEND,
    PERMISSIONS.SMS_CAMPAIGN_MANAGE,
    PERMISSIONS.SMS_TEMPLATE_MANAGE,
    PERMISSIONS.SMS_CREDIT_MANAGE,
  ],
  
  treasurer: [
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_EXPORT,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_CREATE,
    PERMISSIONS.FINANCE_EDIT,
    PERMISSIONS.FINANCE_APPROVE,
    PERMISSIONS.TRANSACTION_VIEW,
    PERMISSIONS.TRANSACTION_CREATE,
    PERMISSIONS.TRANSACTION_EDIT,
    PERMISSIONS.TRANSACTION_CONFIRM,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_CONFIRM,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_FINANCIAL,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
    
    // Cooperative - Financial management
    PERMISSIONS.COOPERATIVE_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE,
    PERMISSIONS.COOPERATIVE_LOANS_VIEW,
    PERMISSIONS.COOPERATIVE_LOANS_APPLY,
    PERMISSIONS.COOPERATIVE_LOANS_MANAGE,
    PERMISSIONS.COOPERATIVE_GUARANTOR,
    
    // Meetings - View and attendance
    PERMISSIONS.MEETING_VIEW,
    PERMISSIONS.MEETING_ATTENDANCE,
    
    // Welfare - Financial management
    PERMISSIONS.WELFARE_VIEW,
    PERMISSIONS.WELFARE_MANAGE,
    PERMISSIONS.WELFARE_CONTRIBUTION_VIEW,
    PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE,
    PERMISSIONS.WELFARE_CONTRIBUTION_CONFIRM,
    PERMISSIONS.WELFARE_PAYOUT_VIEW,
    PERMISSIONS.WELFARE_PAYOUT_REQUEST,
    PERMISSIONS.WELFARE_PAYOUT_APPROVE,
    PERMISSIONS.WELFARE_PAYOUT_DISBURSE,
    
    // SMS - Send and view
    PERMISSIONS.SMS_VIEW,
    PERMISSIONS.SMS_SEND,
    PERMISSIONS.SMS_CAMPAIGN_MANAGE,
    PERMISSIONS.SMS_TEMPLATE_MANAGE,
  ],
  
  financial_secretary: [
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_EXPORT,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_CREATE,
    PERMISSIONS.TRANSACTION_VIEW,
    PERMISSIONS.TRANSACTION_CREATE,
    PERMISSIONS.TRANSACTION_EDIT,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_FINANCIAL,
    PERMISSIONS.REPORT_MEMBER,
    PERMISSIONS.SETTINGS_VIEW,
    
    // Cooperative - Record keeping
    PERMISSIONS.COOPERATIVE_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE,
    PERMISSIONS.COOPERATIVE_LOANS_VIEW,
    PERMISSIONS.COOPERATIVE_LOANS_APPLY,
    PERMISSIONS.COOPERATIVE_GUARANTOR,
    
    // Meetings - View and minutes
    PERMISSIONS.MEETING_VIEW,
    PERMISSIONS.MEETING_MINUTES,
    
    // Welfare - Record keeping
    PERMISSIONS.WELFARE_VIEW,
    PERMISSIONS.WELFARE_CONTRIBUTION_VIEW,
    PERMISSIONS.WELFARE_CONTRIBUTION_MANAGE,
    PERMISSIONS.WELFARE_PAYOUT_VIEW,
    PERMISSIONS.WELFARE_PAYOUT_REQUEST,
    
    // SMS - View and send
    PERMISSIONS.SMS_VIEW,
    PERMISSIONS.SMS_SEND,
  ],
  
  member: [
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.TRANSACTION_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.REPORT_VIEW,
    
    // Cooperative access for members
    PERMISSIONS.COOPERATIVE_VIEW,
    PERMISSIONS.COOPERATIVE_SAVINGS_VIEW,
    PERMISSIONS.COOPERATIVE_LOANS_VIEW,
    PERMISSIONS.COOPERATIVE_LOANS_APPLY,
    PERMISSIONS.COOPERATIVE_GUARANTOR,
    
    // Member self-service finance
    PERMISSIONS.MEMBER_FINANCE_VIEW,
    
    // Meetings - View only
    PERMISSIONS.MEETING_VIEW,
    
    // Welfare - Member access
    PERMISSIONS.WELFARE_VIEW,
    PERMISSIONS.WELFARE_CONTRIBUTION_VIEW,
    PERMISSIONS.WELFARE_PAYOUT_VIEW,
    PERMISSIONS.WELFARE_PAYOUT_REQUEST,
  ],
};

// Helper functions
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: string, requiredPermissions: Permission[]): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return requiredPermissions.some(p => permissions.includes(p));
}

export function hasAllPermissions(role: string, requiredPermissions: Permission[]): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return requiredPermissions.every(p => permissions.includes(p));
}

export function getUserPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function canAccessRoute(role: string, routePermissions: Permission[]): boolean {
  if (!routePermissions || routePermissions.length === 0) return true;
  return hasAnyPermission(role, routePermissions);
}

// Role checking helpers
export function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
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
