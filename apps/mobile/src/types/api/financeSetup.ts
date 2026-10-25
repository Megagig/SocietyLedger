import type { MoneyValue } from './common';

/**
 * Setting up what members are charged (`/api/finance`): categories, and levy campaigns (`/api/finance/advanced/levies`).
 * A levy is a debt: closing a campaign only stops new members being added, the charges already raised stay owed.
 */

export type CategoryKind = 'due' | 'levy' | 'donation' | 'penalty';
export type CategoryFrequency = 'one-time' | 'monthly' | 'quarterly' | 'annual';

export type CategoryDTO = {
  id: number;
  name: string;
  type: CategoryKind;
  amount: MoneyValue | null;
  frequency: CategoryFrequency | null;
  description: string | null;
  isActive: boolean;
  /** Charges and levy campaigns that use it — its type is locked once this is above 0. */
  usageCount: number;
};

export type CategoryListDTO = {
  categories: CategoryDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type CategoryListParams = { page?: number; limit?: number; type?: CategoryKind; isActive?: boolean; search?: string };

export type CategoryPayload = {
  name: string;
  type: CategoryKind;
  amount: number | null;
  frequency: CategoryFrequency | null;
  description: string | null;
  isActive: boolean;
};

// ---------------------------------------------------------------- levy campaigns

/** CLOSED takes no new members; COMPLETED is worked out by the API once everyone assigned has paid. */
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

export type CampaignProgressDTO = {
  totalAssigned: number;
  totalCollected: number;
  remaining: number;
  /** What the assigned members still owe — stays owed after the campaign closes. */
  stillOwed: number;
  progressPercentage: number;
  assignedMembers: number;
  paidCount: number;
};

export type CampaignListItemDTO = {
  id: number;
  name: string;
  description: string | null;
  targetAmount: MoneyValue;
  amountPerMember: MoneyValue | null;
  deadline: string;
  status: CampaignStatus;
  category: { id: number; name: string };
  progress: CampaignProgressDTO;
};

export type CampaignListDTO = {
  campaigns: CampaignListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type AssignmentStatus = 'paid' | 'partial' | 'pending';

export type CampaignAssignmentDTO = {
  id: number;
  memberId: number;
  amount: MoneyValue;
  assignedAt: string;
  paidAmount: number;
  balance: number;
  calculatedStatus: AssignmentStatus;
  member: { id: number; memberId: string | null; firstName: string; lastName: string; email: string | null };
  transaction: { id: number; status: string } | null;
};

export type CampaignDetailDTO = Omit<CampaignListItemDTO, 'progress'> & {
  progress: CampaignProgressDTO & { partialCount: number; pendingCount: number };
  assignments: CampaignAssignmentDTO[];
};

export type CreateCampaignPayload = {
  categoryId: number;
  name: string;
  description?: string;
  targetAmount: number;
  amountPerMember?: number;
  deadline: string;
};

export type UpdateCampaignPayload = Partial<Omit<CreateCampaignPayload, 'categoryId'>> & { status?: 'ACTIVE' | 'CLOSED' };

/** Either a chosen list, or every active member. Members already in the campaign are skipped. */
export type AssignMembersPayload = { memberIds?: number[]; allActive?: boolean; amount?: number };
export type AssignMembersResultDTO = { assigned: number; skipped: number };
