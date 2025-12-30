import { apiGet, apiPost } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// COOPERATIVES API CLIENT
// ============================================

// Dashboard
export async function getCooperativeDashboard() {
  const response = await apiGet(`${API_URL}/api/cooperatives/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch cooperative dashboard');
  return response.json();
}

export async function getMyCooperativeProfile() {
  const response = await apiGet(`${API_URL}/api/cooperatives/my-profile`);
  if (!response.ok) throw new Error('Failed to fetch cooperative profile');
  return response.json();
}

export async function getMemberCooperativeProfile(memberId: number) {
  const response = await apiGet(`${API_URL}/api/cooperatives/members/${memberId}/profile`);
  if (!response.ok) throw new Error('Failed to fetch member cooperative profile');
  return response.json();
}

// Savings Accounts
export async function getSavingsAccounts(params?: {
  page?: number;
  limit?: number;
  memberId?: number;
  accountType?: string;
  status?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.memberId) searchParams.set('memberId', params.memberId.toString());
  if (params?.accountType) searchParams.set('accountType', params.accountType);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/cooperatives/savings-accounts?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch savings accounts');
  return response.json();
}

export async function getSavingsAccount(id: number) {
  const response = await apiGet(`${API_URL}/api/cooperatives/savings-accounts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch savings account');
  return response.json();
}

export async function createSavingsAccount(data: {
  memberId: number;
  accountType?: string;
  targetAmount?: number;
  monthlyContribution?: number;
  interestRate?: number;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/savings-accounts`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create savings account');
  }
  return response.json();
}

export async function processSavingsTransaction(data: {
  savingsAccountId: number;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/savings-transactions`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process transaction');
  }
  return response.json();
}

export async function getSavingsTransactions(params?: {
  page?: number;
  limit?: number;
  savingsAccountId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.savingsAccountId) searchParams.set('savingsAccountId', params.savingsAccountId.toString());
  if (params?.type) searchParams.set('type', params.type);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/cooperatives/savings-transactions?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch savings transactions');
  return response.json();
}

// Loan Products
export async function getLoanProducts(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/cooperatives/loan-products?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch loan products');
  return response.json();
}

export async function createLoanProduct(data: {
  name: string;
  description?: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  interestType: string;
  minTenureMonths: number;
  maxTenureMonths: number;
  processingFeePercent?: number;
  processingFeeFixed?: number;
  requiresGuarantor?: boolean;
  minGuarantors?: number;
  maxLoanToSavingsRatio?: number;
  gracePeriodDays?: number;
  lateFeePercent?: number;
  lateFeeFixed?: number;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/loan-products`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create loan product');
  }
  return response.json();
}

// Loan Applications
export async function getLoanApplications(params?: {
  page?: number;
  limit?: number;
  memberId?: number;
  status?: string;
  loanProductId?: number;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.memberId) searchParams.set('memberId', params.memberId.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.loanProductId) searchParams.set('loanProductId', params.loanProductId.toString());
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/cooperatives/loan-applications?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch loan applications');
  return response.json();
}

export async function getLoanApplication(id: number) {
  const response = await apiGet(`${API_URL}/api/cooperatives/loan-applications/${id}`);
  if (!response.ok) throw new Error('Failed to fetch loan application');
  return response.json();
}

export async function createLoanApplication(data: {
  loanProductId: number;
  amount: number;
  tenureMonths: number;
  purpose: string;
  guarantorIds?: number[];
  collateralDescription?: string;
  collateralValue?: number;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/loan-applications`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create loan application');
  }
  return response.json();
}

export async function reviewLoanApplication(id: number, data: {
  action: 'approve' | 'reject' | 'request_info';
  comments?: string;
  rejectionReason?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/loan-applications/${id}/review`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to review loan application');
  }
  return response.json();
}

export async function disburseLoan(id: number, data: {
  disbursementMethod: string;
  bankAccountId?: number;
  savingsAccountId?: number;
  reference?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/loan-applications/${id}/disburse`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disburse loan');
  }
  return response.json();
}

// Guarantors
export async function getPendingGuarantorRequests() {
  const response = await apiGet(`${API_URL}/api/cooperatives/guarantor-requests/pending`);
  if (!response.ok) throw new Error('Failed to fetch guarantor requests');
  return response.json();
}

export async function respondToGuarantorRequest(id: number, data: {
  action: 'accept' | 'decline';
  declineReason?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/guarantor-requests/${id}/respond`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to respond to guarantor request');
  }
  return response.json();
}

// Loans
export async function getLoans(params?: {
  page?: number;
  limit?: number;
  memberId?: number;
  status?: string;
  loanProductId?: number;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.memberId) searchParams.set('memberId', params.memberId.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.loanProductId) searchParams.set('loanProductId', params.loanProductId.toString());
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/cooperatives/loans?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch loans');
  return response.json();
}

export async function getLoan(id: number) {
  const response = await apiGet(`${API_URL}/api/cooperatives/loans/${id}`);
  if (!response.ok) throw new Error('Failed to fetch loan');
  return response.json();
}

export async function processLoanRepayment(data: {
  loanId: number;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/cooperatives/loan-repayments`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process loan repayment');
  }
  return response.json();
}

export async function getLoanRepayments(params?: {
  page?: number;
  limit?: number;
  loanId?: number;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.loanId) searchParams.set('loanId', params.loanId.toString());
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/cooperatives/loan-repayments?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch loan repayments');
  return response.json();
}
