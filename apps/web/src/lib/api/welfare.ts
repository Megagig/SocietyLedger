import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// WELFARE & SOCIAL FUNDS API CLIENT
// Phase 5.5
// ============================================

// Types
export interface WelfareFund {
  id: number;
  name: string;
  description?: string;
  fundType: 'GENERAL' | 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING';
  targetBalance?: string;
  currentBalance: string;
  monthlyContribution?: string;
  isContributionMandatory: boolean;
  minContribution?: string;
  maxPayout?: string;
  waitingPeriodDays: number;
  minContributionMonths: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: string;
  _count?: {
    contributions: number;
    payoutRequests: number;
  };
  stats?: {
    totalContributions: string;
    totalPayouts: string;
    contributorCount: number;
  };
}

export interface WelfareContribution {
  id: number;
  fundId: number;
  memberId: number;
  amount: string;
  contributionDate: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  confirmedAt?: string;
  fund: { id: number; name: string; fundType: string };
  member: { id: number; memberId: string; firstName: string; lastName: string };
  confirmer?: { id: number; email: string };
}

export interface WelfarePayoutRequest {
  id: number;
  fundId: number;
  memberId: number;
  requestNumber: string;
  payoutType: 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING' | 'OTHER';
  amount: string;
  reason: string;
  supportingDocuments?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED';
  approvedAmount?: string;
  reviewComments?: string;
  rejectionReason?: string;
  disbursementMethod?: string;
  disbursementReference?: string;
  requestedAt: string;
  fund: { id: number; name: string; fundType: string };
  member: { id: number; memberId: string; firstName: string; lastName: string };
  reviewer?: { id: number; email: string };
  approver?: { id: number; email: string };
  disburser?: { id: number; email: string };
}

export interface WelfareDashboard {
  totalFunds: number;
  activeFunds: number;
  totalBalance: string;
  totalContributions: string;
  totalPayouts: string;
  pendingPayoutRequests: number;
  memberParticipationRate: number;
}

export interface MemberWelfareProfile {
  memberId: number;
  memberName: string;
  totalContributions: string;
  contributionCount: number;
  lastContributionDate?: string;
  totalPayoutsReceived: string;
  payoutCount: number;
  eligibleFunds: number[];
  pendingRequests: number;
}

// Dashboard
export async function getWelfareDashboard(): Promise<{ success: boolean; data: WelfareDashboard }> {
  const response = await apiGet(`${API_URL}/api/welfare/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch welfare dashboard');
  return response.json();
}

export async function getFundSummaries() {
  const response = await apiGet(`${API_URL}/api/welfare/fund-summaries`);
  if (!response.ok) throw new Error('Failed to fetch fund summaries');
  return response.json();
}

export async function checkEligibility(fundId: number, memberId?: number) {
  const params = new URLSearchParams({ fundId: fundId.toString() });
  if (memberId) params.set('memberId', memberId.toString());
  const response = await apiGet(`${API_URL}/api/welfare/eligibility?${params}`);
  if (!response.ok) throw new Error('Failed to check eligibility');
  return response.json();
}

export async function getMyWelfareProfile(): Promise<{ success: boolean; data: MemberWelfareProfile }> {
  const response = await apiGet(`${API_URL}/api/welfare/my-profile`);
  if (!response.ok) throw new Error('Failed to fetch welfare profile');
  return response.json();
}

export async function getMemberWelfareProfile(memberId: number): Promise<{ success: boolean; data: MemberWelfareProfile }> {
  const response = await apiGet(`${API_URL}/api/welfare/members/${memberId}/profile`);
  if (!response.ok) throw new Error('Failed to fetch member welfare profile');
  return response.json();
}

// Welfare Funds
export async function getWelfareFunds(params?: {
  page?: number;
  limit?: number;
  fundType?: string;
  status?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.fundType) searchParams.set('fundType', params.fundType);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiGet(`${API_URL}/api/welfare/funds?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch welfare funds');
  return response.json();
}

export async function getWelfareFund(id: number): Promise<{ success: boolean; data: WelfareFund }> {
  const response = await apiGet(`${API_URL}/api/welfare/funds/${id}`);
  if (!response.ok) throw new Error('Failed to fetch welfare fund');
  return response.json();
}

export async function createWelfareFund(data: {
  name: string;
  description?: string;
  fundType: string;
  targetBalance?: number;
  monthlyContribution?: number;
  isContributionMandatory?: boolean;
  minContribution?: number;
  maxPayout?: number;
  waitingPeriodDays?: number;
  minContributionMonths?: number;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/funds`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create welfare fund');
  }
  return response.json();
}

export async function updateWelfareFund(id: number, data: Partial<{
  name: string;
  description: string;
  fundType: string;
  targetBalance: number;
  monthlyContribution: number;
  isContributionMandatory: boolean;
  minContribution: number;
  maxPayout: number;
  waitingPeriodDays: number;
  minContributionMonths: number;
  status: string;
}>) {
  const response = await apiPut(`${API_URL}/api/welfare/funds/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update welfare fund');
  }
  return response.json();
}

export async function deleteWelfareFund(id: number) {
  const response = await apiDelete(`${API_URL}/api/welfare/funds/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete welfare fund');
  }
  return response.json();
}


// Contributions
export async function getWelfareContributions(params?: {
  page?: number;
  limit?: number;
  fundId?: number;
  memberId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.fundId) searchParams.set('fundId', params.fundId.toString());
  if (params?.memberId) searchParams.set('memberId', params.memberId.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/welfare/contributions?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch contributions');
  return response.json();
}

export async function recordContribution(data: {
  fundId: number;
  memberId: number;
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/contributions`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to record contribution');
  }
  return response.json();
}

export async function bulkRecordContributions(data: {
  fundId: number;
  memberIds: number[];
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/contributions/bulk`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to record contributions');
  }
  return response.json();
}

export async function confirmContribution(id: number, data: {
  status: 'CONFIRMED' | 'REJECTED';
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/contributions/${id}/confirm`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to confirm contribution');
  }
  return response.json();
}

// Payout Requests
export async function getPayoutRequests(params?: {
  page?: number;
  limit?: number;
  fundId?: number;
  memberId?: number;
  status?: string;
  payoutType?: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.fundId) searchParams.set('fundId', params.fundId.toString());
  if (params?.memberId) searchParams.set('memberId', params.memberId.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.payoutType) searchParams.set('payoutType', params.payoutType);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const response = await apiGet(`${API_URL}/api/welfare/payouts?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch payout requests');
  return response.json();
}

export async function getPayoutRequest(id: number) {
  const response = await apiGet(`${API_URL}/api/welfare/payouts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch payout request');
  return response.json();
}

export async function createPayoutRequest(data: {
  fundId: number;
  payoutType: string;
  amount: number;
  reason: string;
  supportingDocuments?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/payouts`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payout request');
  }
  return response.json();
}

export async function createBereavementRequest(data: {
  fundId: number;
  amount: number;
  deceasedName: string;
  relationship: string;
  dateOfDeath: string;
  supportingDocuments?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/payouts/bereavement`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create bereavement request');
  }
  return response.json();
}

export async function reviewPayoutRequest(id: number, data: {
  status: 'APPROVED' | 'REJECTED';
  approvedAmount?: number;
  comments?: string;
  rejectionReason?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/payouts/${id}/review`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to review payout request');
  }
  return response.json();
}

export async function disbursePayoutRequest(id: number, data: {
  disbursementMethod: string;
  disbursementReference?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/welfare/payouts/${id}/disburse`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disburse payout');
  }
  return response.json();
}

export async function cancelPayoutRequest(id: number) {
  const response = await apiPost(`${API_URL}/api/welfare/payouts/${id}/cancel`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel payout request');
  }
  return response.json();
}
