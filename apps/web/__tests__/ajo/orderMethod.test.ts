const post = jest.fn().mockResolvedValue({ data: { data: { eventId: 1 } } });
const get = jest.fn().mockResolvedValue({ data: { data: { method: 'RANDOM_DRAW', matches: true } } });
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

import { ajoApi } from '@/lib/ajo/api';
import { ajoStaffApi } from '@/lib/ajo/staffApi';

describe('the payout order, admin-set and checkable', () => {
  it('sends the places in order, with the reason, when the admin sets the order', async () => {
    await ajoStaffApi.setOrder(8, { order: [{ membershipId: 3, shareNo: 1 }, { membershipId: 4, shareNo: 1 }], reason: 'agreed at the 12 Nov meeting' });
    expect(post).toHaveBeenCalledWith('/ajo/groups/8/order/set', { order: [{ membershipId: 3, shareNo: 1 }, { membershipId: 4, shareNo: 1 }], reason: 'agreed at the 12 Nov meeting' }, undefined);
  });

  it('asks the server to run a draw again from its seed', async () => {
    const check = await ajoApi.verifyOrder(8);
    expect(get).toHaveBeenCalledWith('/ajo/groups/8/order/verify');
    expect(check.matches).toBe(true);
  });
});
