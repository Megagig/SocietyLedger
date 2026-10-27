/**
 * Standalone thrift groups (T1.3): a THRIFT_GROUP tenant reaches core modules and Ajo only, whatever its plan or a staff override says,
 * and an ordinary association is unaffected.
 */
const db = {
  platformModule: { findMany: jest.fn() },
  platformFeature: { findMany: jest.fn() },
  subscription: { findMany: jest.fn() },
  tenantModule: { findMany: jest.fn() },
  tenantFeature: { findMany: jest.fn() },
  tenantAddon: { findMany: jest.fn() },
  association: { findUnique: jest.fn() },
};

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: db }));
jest.mock('../../src/modules/admin/platform-settings.service', () => ({ PlatformSettingsService: { getSettings: jest.fn().mockResolvedValue({ gracePeriodDays: 3 }) } }));
jest.mock('../../src/services/billing-override.service', () => ({ BillingOverrideService: { getBillingStatus: jest.fn() } }));

import { computeEntitlements } from '../../src/services/billing/entitlements.service';

const MODULES = [
  { id: 1, code: 'members', name: 'Members', isCore: true, sortOrder: 1 },
  { id: 2, code: 'ledger', name: 'Ledger', isCore: true, sortOrder: 2 },
  { id: 3, code: 'welfare', name: 'Welfare', isCore: false, sortOrder: 3 },
  { id: 4, code: 'sms', name: 'SMS', isCore: false, sortOrder: 4 },
  { id: 5, code: 'ajo', name: 'Ajo / Thrift', isCore: false, sortOrder: 5 },
];
const FEATURES = [
  { id: 1, code: 'members.export', name: 'Member export', isCore: false, sortOrder: 1, module: MODULES[0] },
  { id: 2, code: 'welfare.payouts', name: 'Welfare payouts', isCore: false, sortOrder: 2, module: MODULES[2] },
  { id: 3, code: 'ajo.reminders', name: 'Reminders', isCore: false, sortOrder: 3, module: MODULES[4] },
];

const subscription = (moduleIds: number[], featureIds: number[]) => ({
  id: 1,
  status: 'ACTIVE',
  planVersionId: 10,
  createdAt: new Date('2026-11-01'),
  trialEndsAt: null,
  currentPeriodEnd: new Date('2027-01-01'),
  plan: { code: 'any', name: 'Any' },
  planVersion: { limits: {}, modules: moduleIds.map((moduleId) => ({ moduleId })), features: featureIds.map((featureId) => ({ featureId })) },
});

const ajoAddon = {
  addonVersion: { limits: { ajoContributors: 30 }, modules: [{ moduleId: 5 }], features: [{ featureId: 3 }] },
};

beforeEach(() => {
  jest.resetAllMocks();
  db.platformModule.findMany.mockResolvedValue(MODULES);
  db.platformFeature.findMany.mockResolvedValue(FEATURES);
  db.tenantModule.findMany.mockResolvedValue([]);
  db.tenantFeature.findMany.mockResolvedValue([]);
  db.tenantAddon.findMany.mockResolvedValue([ajoAddon]);
  // jest.resetAllMocks clears the settings stub too
  const { PlatformSettingsService } = jest.requireMock('../../src/modules/admin/platform-settings.service');
  PlatformSettingsService.getSettings.mockResolvedValue({ gracePeriodDays: 3 });
});

describe('a standalone thrift group', () => {
  beforeEach(() => {
    db.association.findUnique.mockResolvedValue({ kind: 'THRIFT_GROUP' });
  });

  it('reaches Ajo and the core modules', async () => {
    // Even a plan that (wrongly) includes welfare and sms must not widen what a thrift group can reach.
    db.subscription.findMany.mockResolvedValue([subscription([3, 4], [2])]);
    const e = await computeEntitlements(1);
    expect(e.modules.get('ajo')?.isEnabled).toBe(true);
    expect(e.modules.get('members')?.isEnabled).toBe(true);
    expect(e.modules.get('ledger')?.isEnabled).toBe(true);
    expect(e.features.get('ajo.reminders')?.isEnabled).toBe(true);
  });

  it('cannot reach any other module or feature, even when its plan includes them', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([3, 4], [1, 2])]);
    const e = await computeEntitlements(1);
    expect(e.modules.get('welfare')?.isEnabled).toBe(false);
    expect(e.modules.get('sms')?.isEnabled).toBe(false);
    expect(e.features.get('welfare.payouts')?.isEnabled).toBe(false);
    expect(e.features.get('members.export')?.isEnabled).toBe(false);
  });

  it('cannot be given another module by a staff override', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([], [])]);
    db.tenantModule.findMany.mockResolvedValue([{ moduleId: 3, isEnabled: true, reason: 'goodwill', expiresAt: null, module: MODULES[2] }]);
    db.tenantFeature.findMany.mockResolvedValue([{ featureId: 2, isEnabled: true, reason: 'goodwill', expiresAt: null, feature: FEATURES[1] }]);
    const e = await computeEntitlements(1);
    expect(e.modules.get('welfare')?.isEnabled).toBe(false);
    expect(e.features.get('welfare.payouts')?.isEnabled).toBe(false);
  });

  it('gets the contributor quota of its Ajo tier', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([], [])]);
    expect((await computeEntitlements(1)).limits.ajoContributors).toBe(30);
  });

  it('has no Ajo without the add-on', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([], [])]);
    db.tenantAddon.findMany.mockResolvedValue([]);
    const e = await computeEntitlements(1);
    expect(e.modules.get('ajo')?.isEnabled).toBe(false);
    expect(e.limits.ajoContributors).toBe(0);
  });
});

describe('an ordinary association', () => {
  beforeEach(() => {
    db.association.findUnique.mockResolvedValue({ kind: 'ASSOCIATION' });
  });

  it('keeps the modules its plan includes, and Ajo only with the add-on', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([3, 4], [2])]);
    const e = await computeEntitlements(2);
    expect(e.modules.get('welfare')?.isEnabled).toBe(true);
    expect(e.modules.get('sms')?.isEnabled).toBe(true);
    expect(e.features.get('welfare.payouts')?.isEnabled).toBe(true);
    expect(e.modules.get('ajo')?.isEnabled).toBe(true);
  });

  it('has no Ajo, and a zero quota, in its plan alone', async () => {
    db.subscription.findMany.mockResolvedValue([subscription([3, 4], [2])]);
    db.tenantAddon.findMany.mockResolvedValue([]);
    const e = await computeEntitlements(3);
    expect(e.modules.get('ajo')?.isEnabled).toBe(false);
    expect(e.limits.ajoContributors).toBe(0);
  });
});
