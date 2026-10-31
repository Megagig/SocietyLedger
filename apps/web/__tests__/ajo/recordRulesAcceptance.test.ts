const post = jest.fn().mockResolvedValue({ data: { data: { activation: { activated: true } } } });
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => post(...a), get: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

import { ajoApi } from '@/lib/ajo/api';

describe('an officer recording rules acceptance in person', () => {
  it('sends the version in force and the note about how it was given', async () => {
    await ajoApi.acceptRules(149, { ruleVersionId: 12, note: 'read aloud at the 14 Nov meeting' });
    expect(post).toHaveBeenCalledWith('/ajo/memberships/149/accept-rules', { ruleVersionId: 12, note: 'read aloud at the 14 Nov meeting' });
  });
});
