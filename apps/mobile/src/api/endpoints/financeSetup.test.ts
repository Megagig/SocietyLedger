const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

import { financeSetupApi } from './financeSetup';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('financeSetupApi categories', () => {
  it('lists categories, sending the active filter as text', async () => {
    mockGet.mockReturnValue(ok({ categories: [] }));
    await financeSetupApi.listCategories({ type: 'levy', isActive: false, page: 2, limit: 20 });
    expect(mockGet).toHaveBeenCalledWith('/finance/categories', { params: { type: 'levy', isActive: 'false', page: 2, limit: 20 } });
    await financeSetupApi.listCategories({ type: 'due' });
    expect(mockGet.mock.calls[1][1].params.isActive).toBeUndefined();
  });

  it('reads, creates and changes one', async () => {
    mockGet.mockReturnValue(ok({ id: 3 }));
    mockPost.mockReturnValue(ok({ id: 3 }));
    mockPatch.mockReturnValue(ok({ id: 3 }));
    await financeSetupApi.getCategory(3);
    await financeSetupApi.createCategory({ name: 'Dues', type: 'due', amount: 5000, frequency: 'monthly', description: null, isActive: true });
    await financeSetupApi.updateCategory(3, { isActive: false });
    expect(mockGet).toHaveBeenCalledWith('/finance/categories/3');
    expect(mockPost).toHaveBeenCalledWith('/finance/categories', expect.objectContaining({ name: 'Dues', type: 'due' }));
    expect(mockPatch).toHaveBeenCalledWith('/finance/categories/3', { isActive: false });
  });
});

describe('financeSetupApi levy campaigns', () => {
  it('lists and reads campaigns', async () => {
    mockGet.mockReturnValue(ok({}));
    await financeSetupApi.listCampaigns({ page: 1, limit: 20 });
    await financeSetupApi.getCampaign(8);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/finance/advanced/levies/campaigns', { params: { page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/finance/advanced/levies/campaigns/8');
  });

  it('starts, changes and closes a campaign', async () => {
    mockPost.mockReturnValue(ok({ id: 8 }));
    mockPatch.mockReturnValue(ok({}));
    await financeSetupApi.createCampaign({ categoryId: 4, name: 'Fund', targetAmount: 1000, deadline: '2027-01-01T00:00:00.000Z' });
    await financeSetupApi.updateCampaign(8, { status: 'CLOSED' });
    expect(mockPost).toHaveBeenCalledWith('/finance/advanced/levies/campaigns', expect.objectContaining({ categoryId: 4 }));
    expect(mockPatch).toHaveBeenCalledWith('/finance/advanced/levies/campaigns/8', { status: 'CLOSED' });
  });

  it('assigns a chosen list or everyone, and removes one assignment', async () => {
    mockPost.mockReturnValue(ok({ assigned: 2, skipped: 0 }));
    mockDelete.mockReturnValue(ok({}));
    await financeSetupApi.assignMembers(8, { memberIds: [1, 2], amount: 5000 });
    await financeSetupApi.assignMembers(8, { allActive: true });
    await financeSetupApi.removeAssignment(8, 31);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/finance/advanced/levies/campaigns/8/assign', { memberIds: [1, 2], amount: 5000 });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/finance/advanced/levies/campaigns/8/assign', { allActive: true });
    expect(mockDelete).toHaveBeenCalledWith('/finance/advanced/levies/campaigns/8/assignments/31');
  });
});
