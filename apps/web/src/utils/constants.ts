// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TREASURER: 'treasurer',
  FINANCIAL_SECRETARY: 'financial_secretary',
  MEMBER: 'member',
} as const;

// Member Status
export const MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
} as const;

// Member Categories
export const MEMBER_CATEGORIES = {
  REGULAR: 'regular',
  EXECUTIVE: 'executive',
  HONORARY: 'honorary',
  STUDENT: 'student',
} as const;

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  WAIVED: 'waived',
  PARTIAL: 'partial',
} as const;

// Financial Categories
export const FINANCIAL_TYPES = {
  DUE: 'due',
  LEVY: 'levy',
  DONATION: 'donation',
  PENALTY: 'penalty',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
  MOBILE_MONEY: 'mobile_money',
  CARD: 'card',
} as const;

// Frequency Types
export const FREQUENCY_TYPES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
  ONE_TIME: 'one-time',
} as const;

// Approval Status
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// Accounting Entry Types
export const ACCOUNTING_ENTRY_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

// Export Types
export const EXPORT_TYPES = {
  FINANCIAL_PDF: 'financial_pdf',
  FINANCIAL_EXCEL: 'financial_excel',
  MEMBER_EXCEL: 'member_excel',
  INDIVIDUAL_MEMBER: 'individual_member',
} as const;

// Export Periods
export const EXPORT_PERIODS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
  CUSTOM: 'custom',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  PAYMENT_DUE: 'payment_due',
  PAYMENT_RECEIVED: 'payment_received',
  SYSTEM: 'system',
  APPROVAL: 'approval',
} as const;

// API Base URL - Points to Express backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// API Routes - All routes now point to Express backend
export const API_ROUTES = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    ME: `${API_BASE_URL}/api/auth/me`,
    REFRESH: `${API_BASE_URL}/api/auth/refresh`,
    VERIFY_EMAIL: `${API_BASE_URL}/api/auth/verify-email`,
    RESEND_VERIFICATION: `${API_BASE_URL}/api/auth/resend-verification`,
    FORGOT_PASSWORD: `${API_BASE_URL}/api/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE_URL}/api/auth/reset-password`,
    PENDING_APPROVALS: `${API_BASE_URL}/api/auth/pending-approvals`,
    APPROVE_USER: `${API_BASE_URL}/api/auth/approve-user`,
    REJECT_USER: `${API_BASE_URL}/api/auth/reject-user`,
  },
  ADMIN: {
    STATS: `${API_BASE_URL}/api/admin/stats`,
    ANALYTICS: `${API_BASE_URL}/api/admin/analytics`,
    AUDIT_LOGS: `${API_BASE_URL}/api/admin/audit-logs`,
    ASSOCIATIONS: `${API_BASE_URL}/api/admin/associations`,
    ASSOCIATION_BY_ID: (id: number) => `${API_BASE_URL}/api/admin/associations/${id}`,
    SUSPEND_ASSOCIATION: (id: number) => `${API_BASE_URL}/api/admin/associations/${id}/suspend`,
    REACTIVATE_ASSOCIATION: (id: number) => `${API_BASE_URL}/api/admin/associations/${id}/reactivate`,
    IMPERSONATE: (associationId: string) => `${API_BASE_URL}/api/admin/impersonate/${associationId}`,
    APPROVALS: `${API_BASE_URL}/api/admin/approvals`,
    APPROVAL_BY_ID: (userId: number) => `${API_BASE_URL}/api/admin/approvals/${userId}`,
    BULK_APPROVALS: `${API_BASE_URL}/api/admin/approvals/bulk`,
  },
  ASSOCIATIONS: {
    CHECK_SUBDOMAIN: `${API_BASE_URL}/api/associations/check-subdomain`,
    SIGNUP: `${API_BASE_URL}/api/associations/signup`,
    BY_ID: (id: string) => `${API_BASE_URL}/api/associations/${id}`,
    SETTINGS: (id: string) => `${API_BASE_URL}/api/associations/${id}/settings`,
  },
  MEMBERS: {
    LIST: `${API_BASE_URL}/api/members`,
    CREATE: `${API_BASE_URL}/api/members`,
    BY_ID: (id: number) => `${API_BASE_URL}/api/members/${id}`,
    TRANSACTIONS: (id: number) => `${API_BASE_URL}/api/members/${id}/transactions`,
    BULK: `${API_BASE_URL}/api/members/bulk`,
  },
  TRANSACTIONS: {
    LIST: `${API_BASE_URL}/api/transactions`,
    CREATE: `${API_BASE_URL}/api/transactions`,
    BY_ID: (id: number) => `${API_BASE_URL}/api/transactions/${id}`,
  },
  PAYMENTS: {
    CREATE: `${API_BASE_URL}/api/payments`,
    BY_ID: (id: number) => `${API_BASE_URL}/api/payments/${id}`,
  },
  ACCOUNTING: {
    ENTRIES: `${API_BASE_URL}/api/accounting/entries`,
    APPROVE: (id: number) => `${API_BASE_URL}/api/accounting/approve/${id}`,
    INCOME: `${API_BASE_URL}/api/accounting/income`,
    EXPENSES: `${API_BASE_URL}/api/accounting/expenses`,
    BALANCE_SHEET: `${API_BASE_URL}/api/accounting/balance-sheet`,
    PROFIT_LOSS: `${API_BASE_URL}/api/accounting/profit-loss`,
    CASH_FLOW: `${API_BASE_URL}/api/accounting/cash-flow`,
  },
  REPORTS: {
    FINANCIAL_SUMMARY: `${API_BASE_URL}/api/reports/financial-summary`,
    MEMBER_BALANCES: `${API_BASE_URL}/api/reports/member-balances`,
    OUTSTANDING_DUES: `${API_BASE_URL}/api/reports/outstanding-dues`,
    PAYMENT_HISTORY: `${API_BASE_URL}/api/reports/payment-history`,
  },
  EXPORTS: {
    FINANCIAL_PDF: `${API_BASE_URL}/api/exports/financial-pdf`,
    FINANCIAL_EXCEL: `${API_BASE_URL}/api/exports/financial-excel`,
    MEMBERS_EXCEL: `${API_BASE_URL}/api/exports/members-excel`,
    MEMBER_EXCEL: (id: number) => `${API_BASE_URL}/api/exports/member-excel/${id}`,
    HISTORY: `${API_BASE_URL}/api/exports/history`,
    DOWNLOAD: (id: number) => `${API_BASE_URL}/api/exports/download/${id}`,
  },
  ONBOARDING: {
    STATUS: `${API_BASE_URL}/api/onboarding/status`,
    COMPLETE_STEP: `${API_BASE_URL}/api/onboarding/complete-step`,
    SKIP: `${API_BASE_URL}/api/onboarding/skip`,
    RESET: `${API_BASE_URL}/api/onboarding/reset`,
  },
  NOTIFICATIONS: {
    LIST: `${API_BASE_URL}/api/notifications`,
    UNREAD_COUNT: `${API_BASE_URL}/api/notifications/unread-count`,
    MARK_READ: (id: number) => `${API_BASE_URL}/api/notifications/${id}/read`,
    MARK_ALL_READ: `${API_BASE_URL}/api/notifications/read-all`,
    DELETE: (id: number) => `${API_BASE_URL}/api/notifications/${id}`,
    CREATE: `${API_BASE_URL}/api/notifications`,
    ANNOUNCEMENT: `${API_BASE_URL}/api/notifications/announcement`,
  },
} as const;

// App Settings
export const APP_CONFIG = {
  NAME: 'Financial Management System',
  VERSION: '1.0.0',
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
  FILE_UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  },
} as const;