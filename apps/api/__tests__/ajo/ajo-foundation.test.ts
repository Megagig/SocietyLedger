/**
 * Ajo foundation (T1.2): the contributor limit, the add-on-only quota, and read-only mode when the add-on expires.
 */
const findFirst = jest.fn();
const getModuleStatus = jest.fn();

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: { ajoGroup: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));
jest.mock('../../src/modules/admin/platform-settings.service', () => ({ PlatformSettingsService: { getSettings: jest.fn() } }));
jest.mock('../../src/services/billing-override.service', () => ({ BillingOverrideService: { getBillingStatus: jest.fn() } }));
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: { getModuleStatus: (...a: unknown[]) => getModuleStatus(...a), getFeatureStatus: jest.fn() },
}));

import { decideAjoAccess, isReadRequest, requireAjoAccess, requireAjoFeature, type AjoRequest } from '../../src/modules/ajo/ajo-access';
import { wouldExceedLimit } from '../../src/modules/ajo/ajo-capacity';
import { mergeLimits } from '../../src/services/billing/entitlements.service';

function run(method: string, options?: Parameters<typeof requireAjoAccess>[0]) {
  const req = { method, tenantId: 7 } as unknown as AjoRequest;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
  const next = jest.fn();
  return requireAjoAccess(options)(req, res as never, next).then(() => ({ req, res, next }));
}

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.FEATURE_FLAG_MODE;
});

describe('the ajoContributors quota is granted by an add-on only', () => {
  it('is zero for a tenant with no Ajo add-on, never unlimited', () => {
    // A plan with no entry for a key is unlimited for ordinary limits; for an add-on-only quota it must not be.
    expect(mergeLimits({ members: 100 }, []).ajoContributors).toBe(0);
  });

  it('takes the add-on tier as the quota', () => {
    expect(mergeLimits({ members: 100 }, [{ ajoContributors: 30 }]).ajoContributors).toBe(30);
  });

  it('ignores a value set on the plan itself', () => {
    expect(mergeLimits({ ajoContributors: 9_999 }, [{ ajoContributors: 30 }]).ajoContributors).toBe(30);
    expect(mergeLimits({ ajoContributors: 9_999 }, []).ajoContributors).toBe(0);
  });

  it('is unlimited for an unlimited (Enterprise) tier', () => {
    expect(mergeLimits({}, [{ ajoContributors: null }]).ajoContributors).toBeNull();
  });

  it('leaves the member limit behaving as before', () => {
    expect(mergeLimits({ members: 100 }, [{ members: 50 }]).members).toBe(150);
    expect(mergeLimits({}, [{ members: 50 }]).members).toBeNull();
  });
});

describe('contributor limit arithmetic', () => {
  it('refuses the contributor after the last free place', () => {
    expect(wouldExceedLimit(30, 30, false)).toBe(true);
    expect(wouldExceedLimit(30, 29, false)).toBe(false);
  });

  it('never counts someone who is already an active contributor again', () => {
    expect(wouldExceedLimit(30, 30, true)).toBe(false);
  });

  it('has no ceiling for an unlimited tier', () => {
    expect(wouldExceedLimit(null, 10_000, false)).toBe(false);
  });

  it('allows nobody when the tenant has no quota at all', () => {
    expect(wouldExceedLimit(0, 0, false)).toBe(true);
  });
});

describe('deciding Ajo access', () => {
  it('is full while the add-on is live', () => {
    expect(decideAjoAccess({ moduleEnabled: true, source: 'addon', hasAjoData: true })).toBe('FULL');
  });

  it('is read-only after the add-on lapses when there is history', () => {
    expect(decideAjoAccess({ moduleEnabled: false, source: 'default', hasAjoData: true })).toBe('READ_ONLY');
  });

  it('is disabled when the add-on was never bought', () => {
    expect(decideAjoAccess({ moduleEnabled: false, source: 'default', hasAjoData: false })).toBe('DISABLED');
  });

  it('is disabled, not read-only, when staff switched Ajo off for the tenant', () => {
    expect(decideAjoAccess({ moduleEnabled: false, source: 'tenant_override', hasAjoData: true })).toBe('DISABLED');
  });

  it('treats only GET, HEAD and OPTIONS as reads', () => {
    expect(['GET', 'head', 'OPTIONS'].every(isReadRequest)).toBe(true);
    expect(['POST', 'PUT', 'PATCH', 'DELETE'].some(isReadRequest)).toBe(false);
  });
});

describe('requireAjoAccess', () => {
  it('lets a tenant with the add-on do anything', async () => {
    getModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: true, source: 'addon' });
    const { next, res } = await run('POST');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('gives a tenant that never had the add-on MODULE_DISABLED', async () => {
    getModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    findFirst.mockResolvedValue(null);
    const { next, res } = await run('GET');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MODULE_DISABLED', upgradeRequired: true }));
  });

  describe('after the add-on expired, with groups on file', () => {
    beforeEach(() => {
      getModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
      findFirst.mockResolvedValue({ id: 1 });
    });

    it('still lets officers read history', async () => {
      const { next, res } = await run('GET');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses a %s with ADDON_EXPIRED', async (method) => {
      const { next, res } = await run(method);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADDON_EXPIRED', readOnly: true }));
    });

    it('lets a read-only POST (an export with a filter) through when the route says so', async () => {
      const { next } = await run('POST', { allowWhenReadOnly: true });
      expect(next).toHaveBeenCalled();
    });
  });

  it('refuses rather than guessing when the check itself fails', async () => {
    getModuleStatus.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { next, res } = await run('GET');
    spy.mockRestore();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('only logs in the emergency shadow mode', async () => {
    process.env.FEATURE_FLAG_MODE = 'shadow';
    getModuleStatus.mockResolvedValue({ name: 'Ajo / Thrift', isEnabled: false, source: 'default' });
    findFirst.mockResolvedValue(null);
    const { next, res } = await run('GET');
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Module-Shadow-Block', 'ajo');
  });
});

describe('requireAjoFeature', () => {
  it('does not switch a feature off for reading history while the add-on is expired', () => {
    const next = jest.fn();
    requireAjoFeature('ajo.advanced_reports')({ ajoAccess: 'READ_ONLY' } as AjoRequest, {} as never, next);
    expect(next).toHaveBeenCalled();
  });
});
