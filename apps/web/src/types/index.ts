export interface SubscriptionAccess {
  allowed: boolean;
  reason: 'OK' | 'TRIAL_NOT_STARTED' | 'TRIAL_ENDED' | 'EXPIRED' | 'CANCELLED' | 'NO_SUBSCRIPTION' | 'NOT_ENFORCED';
  status: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
}

// User Types
export interface User {
  id: number;
  email: string;
  role: string;
  associationId?: number;
  platformRole?: 'SUPER_ADMIN' | 'SUPPORT_AGENT';
  isActive: boolean;
  requiresOnboarding?: boolean;
  /** Where the association's free trial / subscription stands (null for platform staff). */
  subscriptionAccess?: SubscriptionAccess | null;
  permissions?: string[];
  roles?: string[];
  createdAt: Date;
  updatedAt: Date;
  // Association details (optional, populated when needed)
  association?: {
    id: number;
    name: string;
    logo?: string | null;
    subdomain?: string;
  };
}

export interface UserApproval {
  id: number;
  userId: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedById?: number;
  approvalDate?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

// Member Types
export interface Member {
  id: number;
  userId?: number;
  associationId: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  occupation?: string | null;
  category: string;
  status: string;
  loginStatus?: string;
  joinDate?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  financialSummary?: {
    totalDues: number;
    totalPaid: number;
    balance: number;
  };
}

// Financial Types
export interface FinancialCategory {
  id: number;
  associationId: number;
  name: string;
  type: 'due' | 'levy' | 'donation' | 'penalty';
  amount?: number;
  frequency?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  description?: string;
  isActive: boolean;
  /** Charges and levy campaigns that use this category; its type is locked once this is above 0. */
  usageCount?: number;
  createdAt: Date;
}

export interface Transaction {
  id: number;
  associationId: number;
  memberId: number;
  categoryId: number;
  amount: number;
  paymentDate?: Date;
  dueDate?: Date;
  paymentMethod?: string;
  referenceNumber?: string;
  status: 'paid' | 'pending' | 'overdue' | 'waived';
  notes?: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: number;
  associationId: number;
  transactionId: number;
  amountPaid: number;
  paymentDate: Date;
  paymentMethod?: string;
  receiptNumber?: string;
  confirmedBy?: number;
  confirmedAt?: Date;
  createdAt: Date;
}

// Accounting Types
export interface AccountingEntry {
  id: number;
  associationId: number;
  entryType: 'income' | 'expense';
  category: string;
  subcategory?: string;
  amount: number;
  description?: string;
  transactionDate: Date;
  referenceNumber?: string;
  receiptFilePath?: string;
  createdBy: number;
  approvedBy?: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Export Types
export interface ExportHistory {
  id: number;
  associationId: number;
  exportType: 'financial_pdf' | 'financial_excel' | 'member_excel' | 'individual_member';
  exportFormat: 'pdf' | 'excel';
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  exportPeriod?: 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom';
  filePath?: string;
  memberId?: number;
  createdBy: number;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface CreateMemberForm {
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  joinDate?: Date;
  status: string;
  category: string;
}

// Filter and Query Types
export interface TransactionFilters {
  memberId?: number;
  categoryId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface MemberFilters {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Dashboard Types
export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  recentTransactions: Transaction[];
}

// Report Types
export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  membershipDues: number;
  levies: number;
  donations: number;
  penalties: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface MemberBalance {
  memberId: number;
  memberName: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: Date;
}

// Notification Types
export interface Notification {
  id: number;
  associationId: number;
  userId: number;
  title: string;
  message: string;
  type: 'payment_due' | 'payment_received' | 'system';
  entityId?: number | null;
  pushType?: string | null;
  isRead: boolean;
  createdAt: Date;
}