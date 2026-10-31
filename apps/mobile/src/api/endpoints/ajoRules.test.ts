import { ajoApi } from './ajo';

const mockGet = jest.fn();
jest.mock('../client', () => ({ client: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(), put: jest.fn(), patch: jest.fn() } }));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

// The API sends `{ versions, acceptance? }`, not a bare list. A screen that spread the reply as an array crashed ("is not iterable").
describe('ajoApi.ruleVersions', () => {
  it('returns the reply the API really sends: the versions, and for officers how many accepted the newest', async () => {
    const reply = { versions: [{ id: 1, version: 1 }, { id: 2, version: 2 }], acceptance: { latestVersion: 2, accepted: 14, total: 20, pendingMembershipIds: [3, 4] } };
    mockGet.mockReturnValue(ok(reply));
    const result = await ajoApi.ruleVersions(7);
    expect(mockGet).toHaveBeenCalledWith('/ajo/groups/7/rules', expect.anything());
    expect(Array.isArray(result.versions)).toBe(true);
    expect(result.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(result.acceptance).toMatchObject({ accepted: 14, total: 20 });
  });

  it('has no acceptance figures for someone who is not an officer', async () => {
    mockGet.mockReturnValue(ok({ versions: [] }));
    const result = await ajoApi.ruleVersions(7);
    expect(result.versions).toEqual([]);
    expect(result.acceptance).toBeUndefined();
  });
});
