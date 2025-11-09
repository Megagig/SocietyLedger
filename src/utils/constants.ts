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

// API Routes
export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH: '/api/auth/refresh',
    PENDING_APPROVALS: '/api/auth/pending-approvals',
    APPROVE_USER: '/api/auth/approve-user',
    REJECT_USER: '/api/auth/reject-user',
  },
  MEMBERS: {
    LIST: '/api/members',
    CREATE: '/api/members',
    BY_ID: (id: number) => `/api/members/${id}`,
    TRANSACTIONS: (id: number) => `/api/members/${id}/transactions`,
    BULK: '/api/members/bulk',
  },
  TRANSACTIONS: {
    LIST: '/api/transactions',
    CREATE: '/api/transactions',
    BY_ID: (id: number) => `/api/transactions/${id}`,
  },
  PAYMENTS: {
    CREATE: '/api/payments',
    BY_ID: (id: number) => `/api/payments/${id}`,
  },
  ACCOUNTING: {
    ENTRIES: '/api/accounting/entries',
    APPROVE: (id: number) => `/api/accounting/approve/${id}`,
    INCOME: '/api/accounting/income',
    EXPENSES: '/api/accounting/expenses',
    BALANCE_SHEET: '/api/accounting/balance-sheet',
    PROFIT_LOSS: '/api/accounting/profit-loss',
    CASH_FLOW: '/api/accounting/cash-flow',
  },
  REPORTS: {
    FINANCIAL_SUMMARY: '/api/reports/financial-summary',
    MEMBER_BALANCES: '/api/reports/member-balances',
    OUTSTANDING_DUES: '/api/reports/outstanding-dues',
    PAYMENT_HISTORY: '/api/reports/payment-history',
  },
  EXPORTS: {
    FINANCIAL_PDF: '/api/exports/financial-pdf',
    FINANCIAL_EXCEL: '/api/exports/financial-excel',
    MEMBERS_EXCEL: '/api/exports/members-excel',
    MEMBER_EXCEL: (id: number) => `/api/exports/member-excel/${id}`,
    HISTORY: '/api/exports/history',
    DOWNLOAD: (id: number) => `/api/exports/download/${id}`,
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