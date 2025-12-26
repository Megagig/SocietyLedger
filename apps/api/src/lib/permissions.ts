// Permission constants for role-based access control
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
  
  // System Settings
  SYSTEM_SETTINGS_MANAGE: 'system:settings:manage',
  
  // Audit Logs
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role to Permissions mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Super Admin - Platform level access
  super_admin: Object.values(PERMISSIONS),
  
  // Admin - Full association access
  admin: [
    // Members
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_CREATE,
    PERMISSIONS.MEMBER_EDIT,
    PERMISSIONS.MEMBER_DELETE,
    PERMISSIONS.MEMBER_EXPORT,
    
    // Finance
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_CREATE,
    PERMISSIONS.FINANCE_EDIT,
    PERMISSIONS.FINANCE_DELETE,
    PERMISSIONS.FINANCE_APPROVE,
    
    // Transactions
    PERMISSIONS.TRANSACTION_VIEW,
    PERMISSIONS.TRANSACTION_CREATE,
    PERMISSIONS.TRANSACTION_EDIT,
    PERMISSIONS.TRANSACTION_DELETE,
    PERMISSIONS.TRANSACTION_CONFIRM,
    
    // Payments
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_CONFIRM,
    
    // Reports
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_FINANCIAL,
    PERMISSIONS.REPORT_MEMBER,
    PERMISSIONS.REPORT_EXPORT,
    
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    
    // Users
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_APPROVE,
    
    // Association
    PERMISSIONS.ASSOCIATION_VIEW,
    PERMISSIONS.ASSOCIATION_EDIT,
    PERMISSIONS.ASSOCIATION_SETTINGS,
    
    // Subscription
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    
    // Audit
    PERMISSIONS.AUDIT_VIEW,
  ],
  
  // Treasurer - Financial focus
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
  ],
  
  // Financial Secretary - Record keeping
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
  ],
  
  // Member - Basic access
  member: [
    PERMISSIONS.MEMBER_VIEW, // Can view other members
    PERMISSIONS.TRANSACTION_VIEW, // Can view their own transactions
    PERMISSIONS.PAYMENT_VIEW, // Can view their own payments
    PERMISSIONS.REPORT_VIEW, // Can view basic reports
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
