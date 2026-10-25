import { donationsPenaltiesApi } from './donationsPenalties';

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

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const BASE = '/finance/advanced';

beforeEach(() => jest.clearAllMocks());

describe('donations', () => {
  it('reads the stats, the list and a receipt', async () => {
    mockGet.mockReturnValue(ok({}));
    await donationsPenaltiesApi.getDonationStats();
    await donationsPenaltiesApi.listDonations({ page: 2, limit: 20 });
    await donationsPenaltiesApi.getReceipt(12);
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/donations/stats`);
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/donations`, { params: { page: 2, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(3, `${BASE}/donations/12/receipt`);
  });

  it('records a donation or a pledge', async () => {
    mockPost.mockReturnValue(ok({ donationRecord: { id: 5, receiptNumber: 'DON-1' } }));
    await donationsPenaltiesApi.recordDonation({ memberId: 3, categoryId: 8, amount: 5000, donationType: 'instant', paymentMethod: 'cash' });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/donations/record`, expect.objectContaining({ memberId: 3, donationType: 'instant' }));
  });

  it('lists funds (sending the active filter as text), creates and changes one', async () => {
    mockGet.mockReturnValue(ok({ allocations: [] }));
    mockPost.mockReturnValue(ok({ id: 2 }));
    mockPatch.mockReturnValue(ok({ id: 2 }));
    await donationsPenaltiesApi.listAllocations({ isActive: true, limit: 100 });
    await donationsPenaltiesApi.createAllocation({ name: 'Hall roof', type: 'project' });
    await donationsPenaltiesApi.updateAllocation(2, { isActive: false });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/donations/allocations`, { params: { isActive: 'true', limit: 100 } });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/donations/allocations`, { name: 'Hall roof', type: 'project' });
    expect(mockPatch).toHaveBeenCalledWith(`${BASE}/donations/allocations/2`, { isActive: false });
  });
});

describe('penalties', () => {
  it('lists rules, creates, changes and deletes one', async () => {
    mockGet.mockReturnValue(ok({ rules: [] }));
    mockPost.mockReturnValue(ok({ id: 4 }));
    mockPatch.mockReturnValue(ok({ id: 4 }));
    mockDelete.mockReturnValue(ok({}));
    await donationsPenaltiesApi.listRules({ page: 1, limit: 20 });
    await donationsPenaltiesApi.createRule({ name: 'Late', triggerType: 'late_payment', gracePeriodDays: 7, feeType: 'fixed', feeAmount: 500 });
    await donationsPenaltiesApi.updateRule(4, { isActive: false });
    await donationsPenaltiesApi.deleteRule(4);
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/penalties/rules`, { params: { page: 1, limit: 20 } });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/penalties/rules`, expect.objectContaining({ feeAmount: 500 }));
    expect(mockPatch).toHaveBeenCalledWith(`${BASE}/penalties/rules/4`, { isActive: false });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/penalties/rules/4`);
  });

  it('previews late fees with a read, and only a post applies them', async () => {
    mockGet.mockReturnValue(ok({ count: 0, items: [] }));
    mockPost.mockReturnValue(ok({ applied: 0, totalAmount: 0 }));
    await donationsPenaltiesApi.previewLateFees();
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/penalties/late-fees/preview`);
    expect(mockPost).not.toHaveBeenCalled();
    await donationsPenaltiesApi.applyLateFees();
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/penalties/apply-late-fees`, {});
  });

  it('waives a penalty and lists the waivers', async () => {
    mockPost.mockReturnValue(ok({ id: 7, newAmount: 3000, fullyWaived: false }));
    mockGet.mockReturnValue(ok({ waivers: [] }));
    await donationsPenaltiesApi.waivePenalty(40, { waivedAmount: 2000, reason: 'First offence' });
    await donationsPenaltiesApi.listWaivers({ page: 1, limit: 20 });
    await donationsPenaltiesApi.getPenaltyStats();
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/penalties/40/waive`, { waivedAmount: 2000, reason: 'First offence' });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/penalties/waivers`, { params: { page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/penalties/stats`);
  });
});
