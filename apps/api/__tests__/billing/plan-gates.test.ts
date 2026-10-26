/**
 * A plan card may only promise what the app really withholds from the plans below it.
 *
 * These tests read the route source and the seed catalog and fail when:
 *  - a default plan lists a feature or module that no route enforces (the card would promise something Starter can already do),
 *  - a route checks a module or feature code that is not in the catalog (the check would block everyone, or no one),
 *  - a retired feature is still listed in a plan.
 * They also check the gate itself: it works on routers that skip the tenant resolver (exports) and answers FEATURE_DISABLED.
 */
import fs from 'fs';
import path from 'path';

const mockStatus = jest.fn();
jest.mock('../../src/services/module-feature.service', () => ({
  ModuleFeatureService: {
    getFeatureStatus: (...a: unknown[]) => mockStatus('feature', ...a),
    getModuleStatus: (...a: unknown[]) => mockStatus('module', ...a),
  },
}));

import { DEFAULT_PLANS } from '../../prisma/seeds/plans.seed';
import { requireFeature, requireModule, tenantOf } from '../../src/middleware/module-feature.middleware';

const SRC = path.resolve(__dirname, '../../src/modules');
const SEED = fs.readFileSync(path.resolve(__dirname, '../../prisma/seeds/platform-modules.seed.ts'), 'utf8').replace(/\r\n/g, '\n');

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name.endsWith('.routes.ts') ? [p] : [];
  });
}
const routeSource = routeFiles(SRC).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const enforcedFeatures = new Set([...routeSource.matchAll(/requireFeature\('([^']+)'\)/g)].map((m) => m[1]));
const enforcedModules = new Set([...routeSource.matchAll(/requireModule\('([^']+)'\)/g)].map((m) => m[1]));

const catalogModules = new Set([...SEED.matchAll(/^\s+code: '([a-z_]+)',\n\s+name:/gm)].map((m) => m[1]));
const catalogFeatures = new Set([...SEED.matchAll(/\{ moduleCode: '[a-z_]+', code: '([a-z_.]+)'/g)].map((m) => m[1]));

const [starter, pro, enterprise] = DEFAULT_PLANS;
const allFeatures = new Set(DEFAULT_PLANS.flatMap((p) => p.features));
const allModules = new Set(DEFAULT_PLANS.flatMap((p) => p.modules));

describe('the catalog and the routes agree', () => {
  it('reads a sensible catalog from the seed', () => {
    expect(catalogModules.size).toBeGreaterThan(8);
    expect(catalogFeatures.size).toBeGreaterThan(8);
  });

  it('every feature a default plan lists is enforced by at least one route', () => {
    const promised = [...allFeatures].filter((f) => !enforcedFeatures.has(f));
    expect(promised).toEqual([]);
  });

  it('every module that makes a plan different from Starter is enforced by a route', () => {
    const starterModules = new Set(starter.modules);
    const differentiating = [...allModules].filter((m) => !starterModules.has(m));
    expect(differentiating.filter((m) => !enforcedModules.has(m))).toEqual([]);
  });

  it('every feature and module a plan lists exists in the catalog', () => {
    expect([...allFeatures].filter((f) => !catalogFeatures.has(f))).toEqual([]);
    expect([...allModules].filter((m) => !catalogModules.has(m))).toEqual([]);
  });

  it('every code a route checks exists in the catalog, so a typo cannot block everyone', () => {
    expect([...enforcedFeatures].filter((f) => !catalogFeatures.has(f))).toEqual([]);
    expect([...enforcedModules].filter((m) => !catalogModules.has(m))).toEqual([]);
  });

  it('keeps what was retired out of the catalog and the plans', () => {
    for (const gone of ['reports.scheduled', 'audit.export', 'audit.advanced', 'integrations.api_access', 'integrations.webhooks', 'ai.document_qa']) {
      expect(catalogFeatures.has(gone)).toBe(false);
      expect(allFeatures.has(gone)).toBe(false);
    }
    expect(catalogModules.has('integrations')).toBe(false);
    expect(allModules.has('integrations')).toBe(false);
  });
});

describe('what each default plan includes', () => {
  it('each plan includes everything the plan below it has', () => {
    for (const [lower, higher] of [[starter, pro], [pro, enterprise]] as const) {
      expect(lower.modules.filter((m) => !higher.modules.includes(m))).toEqual([]);
      expect(lower.features.filter((f) => !higher.features.includes(f))).toEqual([]);
    }
  });

  it('gives Starter what a small association needs every day, and keeps welfare for Pro and above', () => {
    expect(starter.modules).toEqual(expect.arrayContaining(['members', 'ledger', 'payments', 'notifications', 'reports', 'meetings']));
    expect(starter.modules).not.toContain('welfare');
    expect(pro.modules).toEqual(expect.arrayContaining(['welfare', 'voting', 'sms', 'audit']));
    expect(enterprise.modules).toEqual(expect.arrayContaining(['accounting', 'cooperatives', 'ai']));
    expect(pro.modules).not.toContain('accounting');
  });

  it('keeps the launch prices', () => {
    expect([starter, pro, enterprise].map((p) => [p.monthlyNaira, p.annualNaira])).toEqual([[8000, 80000], [10000, 100000], [15000, 150000]]);
  });
});

describe('the gate itself', () => {
  const res = () => {
    const r: { statusCode: number; body: unknown; status: (c: number) => typeof r; json: (b: unknown) => typeof r; setHeader: jest.Mock } = {
      statusCode: 200,
      body: undefined,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
      setHeader: jest.fn(),
    };
    return r;
  };
  beforeEach(() => {
    mockStatus.mockReset();
    delete process.env.FEATURE_FLAG_MODE;
  });

  it('finds the association from the signed-in user when the tenant resolver was skipped', () => {
    expect(tenantOf({ tenantId: 7, user: { associationId: 9 } } as never)).toBe(7);
    expect(tenantOf({ user: { associationId: 9 } } as never)).toBe(9);
    expect(tenantOf({} as never)).toBeUndefined();
  });

  it('blocks a feature the plan does not include, even on a router with no tenantId (the exports router)', async () => {
    mockStatus.mockResolvedValue({ isEnabled: false, name: 'Financial PDF Export', moduleCode: 'reports', source: 'plan' });
    const r = res();
    const next = jest.fn();
    await requireFeature('reports.export_pdf')({ user: { associationId: 12 }, path: '/financial-pdf' } as never, r as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
    expect(r.body).toMatchObject({ error: 'FEATURE_DISABLED', feature: 'reports.export_pdf', upgradeRequired: true });
    expect(mockStatus).toHaveBeenCalledWith('feature', 12, 'reports.export_pdf');
  });

  it('lets the request through when the plan includes the feature', async () => {
    mockStatus.mockResolvedValue({ isEnabled: true, name: 'x', moduleCode: 'reports', source: 'plan' });
    const next = jest.fn();
    await requireFeature('reports.export_pdf')({ user: { associationId: 12 } } as never, res() as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks a module the plan does not include', async () => {
    mockStatus.mockResolvedValue({ isEnabled: false, name: 'Welfare & Social Funds', source: 'plan' });
    const r = res();
    const next = jest.fn();
    await requireModule('welfare')({ tenantId: 12, path: '/api/welfare' } as never, r as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ error: 'MODULE_DISABLED' });
  });

  it('only logs and lets through when the emergency shadow switch is set', async () => {
    process.env.FEATURE_FLAG_MODE = 'shadow';
    mockStatus.mockResolvedValue({ isEnabled: false, name: 'x', moduleCode: 'ledger', source: 'plan' });
    const next = jest.fn();
    await requireFeature('ledger.bulk_transactions')({ tenantId: 12 } as never, res() as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('does nothing for a request with no association at all (platform staff)', async () => {
    const next = jest.fn();
    await requireFeature('ledger.bulk_transactions')({} as never, res() as never, next);
    expect(next).toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
