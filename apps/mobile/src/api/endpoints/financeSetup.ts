import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AssignMembersPayload,
  AssignMembersResultDTO,
  CampaignDetailDTO,
  CampaignListDTO,
  CampaignStatus,
  CategoryDTO,
  CategoryListDTO,
  CategoryListParams,
  CategoryPayload,
  CreateCampaignPayload,
  UpdateCampaignPayload,
} from '@/types/api/financeSetup';

/**
 * Setting up what members are charged. Categories: view `ledger.view`, create `ledger.create`, edit and switch off `ledger.edit`.
 * Levy campaigns live under `/finance/advanced/levies`. Rule failures answer 400/404/409 with a plain-words `message` and a `code`
 * (`CATEGORY_IN_USE`, `CATEGORY_HAS_OPEN_CHARGES`, `CAMPAIGN_NOT_ACTIVE`, `INVALID_CAMPAIGN_STATUS`, `ASSIGNMENT_HAS_PAYMENTS`, `DEADLINE_IN_PAST`).
 */
export const financeSetupApi = {
  /** GET /finance/categories — every category (active or not) with how many charges and campaigns use it. */
  async listCategories(params: CategoryListParams): Promise<CategoryListDTO> {
    const query = { ...params, isActive: params.isActive === undefined ? undefined : String(params.isActive) };
    return unwrap<CategoryListDTO>(client.get('/finance/categories', { params: query }));
  },

  async getCategory(id: number): Promise<CategoryDTO> {
    return unwrap<CategoryDTO>(client.get(`/finance/categories/${id}`));
  },

  async createCategory(payload: CategoryPayload): Promise<CategoryDTO> {
    return unwrap<CategoryDTO>(client.post('/finance/categories', payload));
  },

  /** PATCH /finance/categories/:id — 409 `CATEGORY_IN_USE` when the type changes on a category in use; 400 when switching off a category with open charges. */
  async updateCategory(id: number, payload: Partial<CategoryPayload>): Promise<CategoryDTO> {
    return unwrap<CategoryDTO>(client.patch(`/finance/categories/${id}`, payload));
  },

  async listCampaigns(params: { page?: number; limit?: number; status?: CampaignStatus }): Promise<CampaignListDTO> {
    return unwrap<CampaignListDTO>(client.get('/finance/advanced/levies/campaigns', { params }));
  },

  async getCampaign(id: number): Promise<CampaignDetailDTO> {
    return unwrap<CampaignDetailDTO>(client.get(`/finance/advanced/levies/campaigns/${id}`));
  },

  /** POST …/campaigns — 400 `DEADLINE_IN_PAST` for a deadline before today. */
  async createCampaign(payload: CreateCampaignPayload): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.post('/finance/advanced/levies/campaigns', payload));
  },

  /** PATCH …/campaigns/:id — `status: 'CLOSED'` stops new members; it never touches the charges already raised. */
  async updateCampaign(id: number, payload: UpdateCampaignPayload): Promise<unknown> {
    return unwrap<unknown>(client.patch(`/finance/advanced/levies/campaigns/${id}`, payload));
  },

  /** POST …/campaigns/:id/assign — each new member gets a charge on their ledger. 409 when the campaign is not active. */
  async assignMembers(id: number, payload: AssignMembersPayload): Promise<AssignMembersResultDTO> {
    return unwrap<AssignMembersResultDTO>(client.post(`/finance/advanced/levies/campaigns/${id}/assign`, payload));
  },

  /** DELETE …/assignments/:assignmentId — a correction: voids the charge and takes it off the ledger. 409 once the member has paid something. */
  async removeAssignment(campaignId: number, assignmentId: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`/finance/advanced/levies/campaigns/${campaignId}/assignments/${assignmentId}`));
  },
};
