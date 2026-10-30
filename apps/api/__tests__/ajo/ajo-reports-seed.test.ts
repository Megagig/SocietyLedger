/**
 * Giving Business and Enterprise the audit report (T10). The add-on seed never touches an add-on that already exists, so a database
 * seeded before T10 needs this one step to give its Business and Enterprise tiers the new feature. Tested with a stand-in for the
 * database, so it can never touch real tiers: it must add the feature once, to published versions of those two tiers only, and a
 * second run must change nothing.
 */
import type { PrismaClient } from '@prisma/client';
import { AJO_TIERS, ensureAjoAuditFeature } from '../../prisma/seeds/ajo-addons.seed';

type Version = { id: number; status: 'PUBLISHED' | 'DRAFT'; addonCode: string };

function fakeDb(versions: Version[], featureExists = true, actor: { id: number } | null = { id: 1 }) {
  const links = new Set<string>();
  const db = {
    user: { findFirst: jest.fn(async () => actor) },
    platformActionLog: { create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 1 })) },
    platformFeature: { findUnique: jest.fn(async () => (featureExists ? { id: 77, code: 'ajo.audit_reports' } : null)) },
    addonVersion: {
      findMany: jest.fn(async ({ where }: { where: { status: string; addon: { code: { in: string[] } } } }) =>
        versions.filter((v) => v.status === where.status && where.addon.code.in.includes(v.addonCode)).map((v) => ({ id: v.id }))),
    },
    addonVersionFeature: {
      findUnique: jest.fn(async ({ where }: { where: { addonVersionId_featureId: { addonVersionId: number; featureId: number } } }) =>
        links.has(`${where.addonVersionId_featureId.addonVersionId}:${where.addonVersionId_featureId.featureId}`) ? { id: 1 } : null),
      create: jest.fn(async ({ data }: { data: { addonVersionId: number; featureId: number } }) => {
        links.add(`${data.addonVersionId}:${data.featureId}`);
        return { id: 2 };
      }),
    },
  };
  return { db: db as unknown as PrismaClient, mocks: db, links };
}

describe('the audit report belongs to Business and above', () => {
  it('is a feature of Business and Enterprise only, so Starter, Growth and the trial do not get it', () => {
    const has = (code: string) => AJO_TIERS.find((t) => t.code === code)!.features.includes('ajo.audit_reports');
    expect(has('ajo-business')).toBe(true);
    expect(has('ajo-enterprise')).toBe(true);
    expect(has('ajo-starter')).toBe(false);
    expect(has('ajo-growth')).toBe(false);
  });

  it('keeps advanced reports for Growth and above', () => {
    for (const code of ['ajo-growth', 'ajo-business', 'ajo-enterprise']) expect(AJO_TIERS.find((t) => t.code === code)!.features).toContain('ajo.advanced_reports');
    expect(AJO_TIERS.find((t) => t.code === 'ajo-starter')!.features).not.toContain('ajo.advanced_reports');
  });
});

describe('ensureAjoAuditFeature', () => {
  const versions: Version[] = [
    { id: 1, status: 'PUBLISHED', addonCode: 'ajo-business' },
    { id: 2, status: 'PUBLISHED', addonCode: 'ajo-enterprise' },
    { id: 3, status: 'DRAFT', addonCode: 'ajo-business' }, // the Plan Builder's draft: left alone
    { id: 4, status: 'PUBLISHED', addonCode: 'ajo-growth' }, // not a tier that gets it
    { id: 5, status: 'PUBLISHED', addonCode: 'ajo-starter' },
  ];

  it('adds the feature to the published Business and Enterprise versions, and to nothing else', async () => {
    const { db, links } = fakeDb(versions);
    expect(await ensureAjoAuditFeature(db)).toBe(2);
    expect([...links].sort()).toEqual(['1:77', '2:77']);
  });

  it('writes each change to the staff Action log with its reason, because it edits a published version outside the Plan Builder', async () => {
    const { db, mocks } = fakeDb(versions);
    await ensureAjoAuditFeature(db);
    const rows = mocks.platformActionLog.create.mock.calls.map((c) => c[0].data);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.targetId).sort()).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ actorId: 1, actionType: 'ADDON_VERSION_FEATURE_ADDED', targetType: 'addon_version' });
    expect(String(rows[0].reason)).toMatch(/audit report belongs to Business and Enterprise/);
  });

  it('still adds the feature, and says nothing false, when the platform has no super admin to name in the log', async () => {
    const { db, mocks, links } = fakeDb(versions, true, null);
    expect(await ensureAjoAuditFeature(db)).toBe(2);
    expect(links.size).toBe(2);
    expect(mocks.platformActionLog.create).not.toHaveBeenCalled();
  });

  it('changes nothing the second time', async () => {
    const { db, mocks, links } = fakeDb(versions);
    await ensureAjoAuditFeature(db);
    mocks.addonVersionFeature.create.mockClear();
    expect(await ensureAjoAuditFeature(db)).toBe(0);
    expect(mocks.addonVersionFeature.create).not.toHaveBeenCalled();
    expect(links.size).toBe(2);
  });

  it('stops with a clear message when the feature has not been seeded yet, rather than half-doing it', async () => {
    const { db, mocks } = fakeDb(versions, false);
    await expect(ensureAjoAuditFeature(db)).rejects.toThrow(/does not exist yet/);
    expect(mocks.addonVersionFeature.create).not.toHaveBeenCalled();
  });
});
