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
    END_IMPERSONATION: `${API_BASE_URL}/api/admin/end-impersonation`,
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
  // Phase 19: Platform Admin Controls
  PLATFORM_ADMIN: {
    // Tenant Management
    TENANTS: `${API_BASE_URL}/api/admin/tenants`,
    TENANT_STATUS: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/status`,
    TENANT_SUSPEND: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/suspend`,
    TENANT_REACTIVATE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/reactivate`,
    TENANT_SOFT_DELETE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/soft-delete`,
    TENANT_RESTORE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/restore`,
    TENANT_PERMANENT_DELETE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/permanent-delete`,
    TENANT_FORCE_LOGOUT: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/force-logout`,
    TENANT_SECURITY: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/security`,
    // Module & Feature Management
    MODULES: `${API_BASE_URL}/api/admin/modules`,
    FEATURES: `${API_BASE_URL}/api/admin/features`,
    TENANT_MODULES: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/modules`,
    TENANT_MODULE_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/modules/override`,
    TENANT_MODULE_REMOVE: (id: number, code: string) => `${API_BASE_URL}/api/admin/tenants/${id}/modules/${code}/override`,
    TENANT_FEATURE_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/features/override`,
    TENANT_FEATURE_REMOVE: (id: number, code: string) => `${API_BASE_URL}/api/admin/tenants/${id}/features/${code}/override`,
    // Billing Overrides
    TENANT_BILLING: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing`,
    TENANT_BILLING_HISTORY: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/history`,
    TENANT_BILLING_OVERRIDE: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/override`,
    TENANT_EXTEND_TRIAL: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/extend-trial`,
    TENANT_APPLY_CREDIT: (id: number) => `${API_BASE_URL}/api/admin/tenants/${id}/billing/apply-credit`,
    BILLING_OVERRIDE_REVOKE: (id: number) => `${API_BASE_URL}/api/admin/billing/overrides/${id}/revoke`,
    // Platform Action Logs
    ACTION_LOGS: `${API_BASE_URL}/api/admin/action-logs`,
    ACTION_LOGS_STATS: `${API_BASE_URL}/api/admin/action-logs/stats`,
    ACTION_LOGS_EXPORT: `${API_BASE_URL}/api/admin/action-logs/export`,
    // Platform Analytics
    ANALYTICS_OVERVIEW: `${API_BASE_URL}/api/admin/analytics/overview`,
    ANALYTICS_MODULE_ADOPTION: `${API_BASE_URL}/api/admin/analytics/module-adoption`,
    ANALYTICS_CHURN: `${API_BASE_URL}/api/admin/analytics/churn`,
    ANALYTICS_REVENUE: `${API_BASE_URL}/api/admin/analytics/revenue`,
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
  // Phase 20: Dashboard Real-Data Integration
  DASHBOARD: {
    OVERVIEW: `${API_BASE_URL}/api/dashboard/overview`,
  },
  // Phase 21: Help & Support Module
  HELP: {
    CENTER: `${API_BASE_URL}/api/help`,
    ARTICLES: `${API_BASE_URL}/api/help/articles`,
    ARTICLE_BY_SLUG: (slug: string) => `${API_BASE_URL}/api/help/articles/${slug}`,
    ARTICLE_SEARCH: `${API_BASE_URL}/api/help/articles/search`,
    ARTICLE_HELPFUL: (id: number) => `${API_BASE_URL}/api/help/articles/${id}/helpful`,
    FAQS: `${API_BASE_URL}/api/help/faqs`,
    FAQS_BY_CATEGORY: `${API_BASE_URL}/api/help/faqs/by-category`,
    QUICK_ACTIONS: `${API_BASE_URL}/api/help/quick-actions`,
    CATEGORIES_ARTICLES: `${API_BASE_URL}/api/help/categories/articles`,
    CATEGORIES_FAQS: `${API_BASE_URL}/api/help/categories/faqs`,
    ARTICLE_CATEGORIES: `${API_BASE_URL}/api/help/categories/articles`,
    FAQ_CATEGORIES: `${API_BASE_URL}/api/help/categories/faqs`,
    // AI Endpoints
    AI_STATUS: `${API_BASE_URL}/api/help/ai/status`,
    AI_SUGGEST_ARTICLES: `${API_BASE_URL}/api/help/ai/suggest-articles`,
    AI_ANSWER: `${API_BASE_URL}/api/help/ai/answer`,
    AI_CATEGORIZE: `${API_BASE_URL}/api/help/ai/categorize`,
    AI_SENTIMENT: `${API_BASE_URL}/api/help/ai/sentiment`,
    AI_SUGGEST_RESPONSE: `${API_BASE_URL}/api/help/ai/suggest-response`,
  },
  SUPPORT: {
    TICKETS: `${API_BASE_URL}/api/support/tickets`,
    TICKET_BY_ID: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}`,
    TICKET_RESPOND: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}/respond`,
    TICKET_CLOSE: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}/close`,
    TICKET_REOPEN: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}/reopen`,
    TICKET_STATS: `${API_BASE_URL}/api/support/tickets/stats`,
    TICKET_COUNT: `${API_BASE_URL}/api/support/tickets/count`,
  },
  // Phase 3.6: Nigerian Payments UI
  NIGERIAN_PAYMENTS: {
    // Bank Accounts
    BANK_ACCOUNTS: `${API_BASE_URL}/api/payments/nigerian/bank-accounts`,
    BANK_ACCOUNT_BY_ID: (id: string) => `${API_BASE_URL}/api/payments/nigerian/bank-accounts/${id}`,
    SET_DEFAULT: (id: string) => `${API_BASE_URL}/api/payments/nigerian/bank-accounts/${id}/set-default`,
    // Bank Transfers
    BANK_TRANSFERS: `${API_BASE_URL}/api/payments/nigerian/bank-transfers`,
    BANK_TRANSFER_BY_ID: (id: string) => `${API_BASE_URL}/api/payments/nigerian/bank-transfers/${id}`,
    VERIFY_TRANSFER: (id: string) => `${API_BASE_URL}/api/payments/nigerian/bank-transfers/${id}/verify`,
    // Reconciliation
    RECONCILIATIONS: `${API_BASE_URL}/api/payments/nigerian/reconciliations`,
    RECONCILIATION_BY_ID: (id: string) => `${API_BASE_URL}/api/payments/nigerian/reconciliations/${id}`,
    CONFIRM_RECONCILIATION: (id: string) => `${API_BASE_URL}/api/payments/nigerian/reconciliations/${id}/confirm`,
    AUTO_MATCH: `${API_BASE_URL}/api/payments/nigerian/auto-match`,
    AUTO_MATCH_APPLY: `${API_BASE_URL}/api/payments/nigerian/auto-match/apply`,
    UNMATCHED_DASHBOARD: `${API_BASE_URL}/api/payments/nigerian/unmatched-dashboard`,
    // Bank Statements
    STATEMENT_IMPORTS: `${API_BASE_URL}/api/payments/nigerian/statement-imports`,
    STATEMENT_IMPORT_BY_ID: (id: string) => `${API_BASE_URL}/api/payments/nigerian/statement-imports/${id}`,
    IMPORT_STATEMENT: `${API_BASE_URL}/api/payments/nigerian/import-statement`,
    STATEMENT_ENTRIES: `${API_BASE_URL}/api/payments/nigerian/statement-entries`,
    // Payment Proofs
    PAYMENT_PROOFS: `${API_BASE_URL}/api/payments/nigerian/proofs`,
    PAYMENT_PROOF_BY_ID: (id: string) => `${API_BASE_URL}/api/payments/nigerian/proofs/${id}`,
    VERIFY_PROOF: (id: string) => `${API_BASE_URL}/api/payments/nigerian/proofs/${id}/verify`,
    // Nigerian Banks
    BANKS: `${API_BASE_URL}/api/payments/nigerian/banks`,
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