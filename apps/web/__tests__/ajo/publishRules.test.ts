const post = jest.fn().mockResolvedValue({ data: { data: { id: 1 } } });
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => post(...a), get: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

import { ajoStaffApi } from '@/lib/ajo/staffApi';

describe('publishRules', () => {
  it('sends the rules inside a `rules` object, which is what the API requires', async () => {
    await ajoStaffApi.publishRules(8, { graceDays: 3, memberVisibility: 'FULL' });
    expect(post).toHaveBeenCalledWith('/ajo/groups/8/rules', { rules: { graceDays: 3, memberVisibility: 'FULL' } }, undefined);
  });
});
