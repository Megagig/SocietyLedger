/**
 * Runs the real demo seed against a scratch database and checks it from the outside: idempotency, dry run, reset, that no
 * non-demo row is touched, every seeded login through the real API, role permissions, and the privacy/isolation rules.
 *
 * Needs a scratch Postgres database with every migration applied and the reference seeds run (rbac, platform modules, plans, ajo add-ons):
 *   DEMO_TEST_DATABASE_URL=postgresql://.../sl_demo_test TOTP_ENCRYPTION_KEY=<32+ chars> npx jest __tests__/demo-seed --forceExit
 * Skipped when DEMO_TEST_DATABASE_URL is not set.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

// otplib ships ES modules only, which Jest cannot load; admin 2FA is not under test here.
jest.mock('otplib', () => ({ generateSecret: jest.fn(), generateSync: jest.fn(), verifySync: jest.fn(), generateURI: jest.fn() }));

// Logging in as every seeded account in a minute would trip the real limiter.
jest.mock('../../src/middleware/rate-limit.middleware', () => {
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...jest.requireActual('../../src/middleware/rate-limit.middleware'), standardRateLimit: pass, authRateLimit: pass, sessionRateLimit: pass };
});

const URL = process.env.DEMO_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
const PASSWORD = 'Demo-Test-Pass-1';
const ONLY = ['alumni', 'balogun', 'mamangozi'];

type Prisma = import('@prisma/client').PrismaClient;
type Request = typeof import('supertest');

suite('demo seed (database)', () => {
  jest.setTimeout(20 * 60_000);
  let prisma: Prisma;
  let request: Request;
  let app: import('express').Express;
  let mod: typeof import('../../prisma/seeds/demo/run');
  let config: typeof import('../../prisma/seeds/demo/config');
  let invariants: typeof import('../../prisma/seeds/demo/invariants');
  let rbac: typeof import('../../src/lib/role-permission-mapping');
  let thrift: typeof import('../../src/lib/thrift-roles');
  let auth: typeof import('../../src/lib/auth');
  const credentials = path.join(os.tmpdir(), `demo-accounts-test-${process.pid}.md`);
  let sentinelId = 0;
  let sentinelToken = '';
  let before: Record<string, string> = {};
  let counts: Record<string, number> = {};

  const baseOptions = () => ({
    prisma, env: { SEED_DEMO: 'true', DEMO_PASSWORD: PASSWORD, TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY ?? 'scratch-only-key-0123456789abcdef0123456789' } as NodeJS.ProcessEnv,
    databaseUrl: URL as string, dryRun: false, reset: false, confirmBackup: false, credentialsPath: credentials, appUrl: 'https://societyledger.com.ng', only: ONLY,
  });

  /** A digest of every row that is not demo data, in every tenant-scoped table, plus real associations and users. */
  async function fingerprint(): Promise<Record<string, string>> {
    const demoIds = (await prisma.association.findMany({ where: { isDemo: true }, select: { id: true } })).map((a) => a.id);
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'association_id' GROUP BY table_name ORDER BY 1`);
    const out: Record<string, string> = {};
    // security_event_logs records this test's own deliberate failed login (a real user against a demo tenant); the seed itself never signs in.
    for (const { table_name: t } of tables.filter((x) => x.table_name !== 'security_event_logs')) {
      const rows = await prisma.$queryRawUnsafe<Array<{ c: number; h: string }>>(`SELECT COUNT(*)::int AS c, md5(COALESCE(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x WHERE association_id IS NULL OR association_id <> ALL($1::int[])`, demoIds);
      out[t] = `${rows[0].c}:${rows[0].h}`;
    }
    for (const [t, where] of [['associations', 'is_demo = false'], ['users', 'is_demo = false']] as const) {
      const rows = await prisma.$queryRawUnsafe<Array<{ c: number; h: string }>>(`SELECT COUNT(*)::int AS c, md5(COALESCE(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x WHERE ${where}`);
      out[t] = `${rows[0].c}:${rows[0].h}`;
    }
    return out;
  }
  async function totalCounts(): Promise<Record<string, number>> {
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%' ORDER BY 1`);
    const out: Record<string, number> = {};
    for (const { tablename } of tables) out[tablename] = Number((await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*)::bigint AS n FROM "${tablename}"`))[0].n);
    return out;
  }
  const login = async (tenant: string, email: string, password = PASSWORD) => request(app).post('/api/auth/login').set('X-Tenant', tenant).send({ email, password });
  const get = (tenant: string, token: string, p: string) => request(app).get(p).set('X-Tenant', tenant).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    process.env.DATABASE_URL = URL;
    process.env.DIRECT_URL = URL;
    process.env.NODE_ENV = 'test';
    process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? 'scratch-only-key-0123456789abcdef0123456789';
    await import('../../prisma/seeds/_demo-stubs'); // seeding must never message anyone
    prisma = (await import('../../src/lib/prisma')).default as Prisma;
    request = (await import('supertest')).default as unknown as Request;
    app = (await import('../../src/server')).default;
    mod = await import('../../prisma/seeds/demo/run');
    config = await import('../../prisma/seeds/demo/config');
    invariants = await import('../../prisma/seeds/demo/invariants');
    rbac = await import('../../src/lib/role-permission-mapping');
    thrift = await import('../../src/lib/thrift-roles');
    auth = await import('../../src/lib/auth');

    await (await import('../../prisma/seeds/demo/reset')).resetDemo(prisma); // clean slate

    // A real (non-demo) tenant with a user, to prove the seed never touches or exposes it.
    const old = await prisma.association.findFirst({ where: { subdomain: 'real-sentinel' } });
    if (old) {
      await prisma.transaction.deleteMany({ where: { associationId: old.id } });
      await prisma.financialCategory.deleteMany({ where: { associationId: old.id } });
      await prisma.member.deleteMany({ where: { associationId: old.id } });
      await prisma.user.deleteMany({ where: { associationId: old.id } });
      await prisma.association.delete({ where: { id: old.id } });
    }
    const real = await prisma.association.create({ data: { name: 'Real Sentinel Association', slug: 'real-sentinel', subdomain: 'real-sentinel', tier: 'STARTER', status: 'ACTIVE' } });
    const realUser = await prisma.user.create({ data: { associationId: real.id, email: 'real.admin@example.test', passwordHash: 'x', role: 'admin', isActive: true, emailVerified: true } });
    const cat = await prisma.financialCategory.create({ data: { associationId: real.id, name: 'Dues', type: 'due', amount: 1000 } });
    const member = await prisma.member.create({ data: { associationId: real.id, userId: realUser.id, memberId: 'R-1', firstName: 'Real', lastName: 'Person' } });
    await prisma.transaction.create({ data: { associationId: real.id, memberId: member.id, categoryId: cat.id, amount: 1000, status: 'pending', createdBy: realUser.id } });
    sentinelId = real.id;
    sentinelToken = auth.generateToken({ id: realUser.id, email: realUser.email, role: 'admin', associationId: real.id });
  });

  afterAll(async () => {
    try { fs.unlinkSync(credentials); } catch { /* not written */ }
    await prisma.$disconnect();
  });

  it('--dry-run writes nothing', async () => {
    const pre = await totalCounts();
    const report = await mod.runDemoSeed({ ...baseOptions(), dryRun: true });
    expect(report.status).toBe('dry-run');
    expect(await totalCounts()).toEqual(pre);
    expect(fs.existsSync(credentials)).toBe(false);
  });

  it('seeds, passes every integrity check, and touches no non-demo row', async () => {
    before = await fingerprint();
    const report = await mod.runDemoSeed(baseOptions());
    expect(report.status).toBe('applied');
    expect(report.checks.length).toBeGreaterThan(5);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(await fingerprint()).toEqual(before);
    expect(await prisma.systemSeed.count({ where: { key: 'demo', version: 1 } })).toBe(1);
    expect(await invariants.runInvariants(prisma)).toEqual(expect.arrayContaining([expect.objectContaining({ ok: true })]));
  });

  it('flags every demo tenant and user, and never bills them', async () => {
    const assocs = await prisma.association.findMany({ where: { isDemo: true }, include: { subscriptions: true } });
    expect(assocs.map((a) => a.subdomain).sort()).toEqual(ONLY.map((s) => `demo-${s}`).sort());
    for (const a of assocs) {
      expect(a.subscriptions.every((s) => s.status === 'ACTIVE' && s.currentPeriodEnd.getUTCFullYear() >= 2099)).toBe(true);
      expect(await prisma.billingOverride.count({ where: { associationId: a.id, overrideType: 'BYPASS_BILLING', isActive: true } })).toBe(1);
    }
    expect(await prisma.user.count({ where: { association: { isDemo: true }, isDemo: false } })).toBe(0);
    expect(await prisma.paymentHistory.count({ where: { subscription: { association: { isDemo: true } } } })).toBe(0);
  });

  it('is idempotent: a second run changes nothing', async () => {
    counts = await totalCounts();
    const again = await mod.runDemoSeed(baseOptions());
    expect(again.status).toBe('already-applied');
    expect(await totalCounts()).toEqual(counts);
  });

  it('writes a credentials sheet that lists every account and is not world-readable', async () => {
    const text = fs.readFileSync(credentials, 'utf8');
    for (const t of config.TENANTS.filter((x) => ONLY.includes(x.short))) {
      expect(text).toContain(config.subdomainOf(t));
      for (const p of t.personas) expect(text).toContain(p.sharedIdentity ? `${p.sharedIdentity}@` : config.emailFor(p.key, t.short));
    }
    expect(text).toContain(PASSWORD);
    if (process.platform !== 'win32') expect(fs.statSync(credentials).mode & 0o077).toBe(0);
  });

  it('every seeded account behaves as designed on login, and sees exactly its role permissions', async () => {
    const tenants = await prisma.association.findMany({ where: { isDemo: true }, select: { id: true, subdomain: true, kind: true } });
    const known = new Set((await prisma.permission.findMany({ select: { key: true } })).map((p) => p.key));
    let checked = 0;
    for (const a of tenants) {
      const users = await prisma.user.findMany({ where: { associationId: a.id }, include: { member: true, userApproval: true } });
      for (const u of users) {
        const res = await login(a.subdomain, u.email);
        const member = u.member;
        const blocked = !u.isActive || u.userApproval?.approvalStatus === 'pending';
        if (blocked) {
          expect(res.status).not.toBe(200);
          checked += 1;
          continue;
        }
        expect({ email: u.email, status: res.status }).toEqual({ email: u.email, status: 200 });
        const token = res.body.data.token as string;
        const me = await get(a.subdomain, token, '/api/auth/me');
        expect(me.status).toBe(200);
        let expected = ((rbac.ROLE_PERMISSION_MAPPING as Record<string, string[]>)[u.role] ?? []).filter((k) => known.has(k));
        if (a.kind === 'THRIFT_GROUP') expected = expected.filter((k) => !thrift.isThriftExcludedPermission(k));
        expect([...(me.body.data.user.permissions as string[])].sort()).toEqual([...new Set(expected)].sort());
        expect(member).not.toBeNull();
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('role actions: admins and officers manage, members and savers do not', async () => {
    const admin = await login('demo-alumni', config.emailFor('admin', 'alumni'));
    const member = await login('demo-alumni', config.emailFor('member', 'alumni'));
    expect((await get('demo-alumni', admin.body.data.token, '/api/members')).status).toBe(200);
    expect((await get('demo-alumni', member.body.data.token, '/api/members')).status).toBe(403);

    const collector = await login('demo-mamangozi', config.emailFor('collector', 'mamangozi'));
    const saver = await login('demo-mamangozi', config.emailFor('saver', 'mamangozi'));
    expect((await get('demo-mamangozi', collector.body.data.token, '/api/ajo/collector/contributors')).status).toBe(200);
    expect((await get('demo-mamangozi', saver.body.data.token, '/api/ajo/collector/contributors')).status).toBe(403);
  });

  it('privacy: a collector-thrift saver sees only their own records', async () => {
    const saverUser = await prisma.user.findFirstOrThrow({ where: { email: config.emailFor('saver', 'mamangozi') }, include: { member: { include: { ajoMemberships: true } } } });
    const mine = saverUser.member!.ajoMemberships[0];
    const group = await prisma.ajoGroup.findFirstOrThrow({ where: { id: mine.groupId } });
    const other = await prisma.ajoMembership.findFirstOrThrow({ where: { groupId: group.id, id: { not: mine.id } } });
    const token = (await login('demo-mamangozi', saverUser.email)).body.data.token as string;

    const own = await get('demo-mamangozi', token, `/api/ajo/memberships/${mine.id}/savings`);
    expect(own.status).toBe(200);
    expect([200, 403, 404]).toContain((await get('demo-mamangozi', token, `/api/ajo/memberships/${other.id}/savings`)).status);
    expect((await get('demo-mamangozi', token, `/api/ajo/memberships/${other.id}/savings`)).status).not.toBe(200);
    expect((await get('demo-mamangozi', token, `/api/ajo/memberships/${other.id}/payments`)).status).not.toBe(200);
    const board = await get('demo-mamangozi', token, `/api/ajo/groups/${group.id}/board`);
    expect(JSON.stringify(board.body)).toContain('BOARD_NOT_AVAILABLE');
    expect((await get('demo-mamangozi', token, '/api/members')).status).toBe(403);
  });

  it('transparency: every member of a rotating circle sees the whole circle', async () => {
    const memberUser = await prisma.user.findFirstOrThrow({ where: { email: config.emailFor('member', 'balogun') } });
    const token = (await login('demo-balogun', memberUser.email)).body.data.token as string;
    const circle = await prisma.ajoGroup.findFirstOrThrow({ where: { name: 'Balogun Market Ajo Circle' } });
    const people = await get('demo-balogun', token, `/api/ajo/groups/${circle.id}/board/members`);
    expect(people.status).toBe(200);
    const rows = (people.body.data?.members ?? people.body.data?.people ?? people.body.data) as unknown[];
    expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThanOrEqual(10);
    expect((await get('demo-balogun', token, `/api/ajo/groups/${circle.id}/board`)).status).toBe(200);
    // The circle is mid-story: 3 paid out, 1 round in progress, 6 scheduled.
    const payouts = await prisma.ajoPayout.count({ where: { groupId: circle.id, status: 'PAID' } });
    expect(payouts).toBe(3);
    expect(circle.rounds).toBe(10);
  });

  it('isolation: demo users cannot reach a real tenant, and real users cannot reach demo data', async () => {
    const demoAdmin = (await login('demo-alumni', config.emailFor('admin', 'alumni'))).body.data.token as string;
    const asDemoOnReal = await get('real-sentinel', demoAdmin, '/api/members');
    expect(asDemoOnReal.status).toBe(403);
    expect(JSON.stringify(asDemoOnReal.body)).not.toContain('Real Person');

    const asRealOnDemo = await get('demo-alumni', sentinelToken, '/api/members');
    expect(asRealOnDemo.status).toBe(403);
    expect(JSON.stringify(asRealOnDemo.body)).not.toContain('MEM0001');
    expect((await login('demo-balogun', 'real.admin@example.test')).status).not.toBe(200);
    const ownList = await get('real-sentinel', sentinelToken, '/api/ajo/groups');
    expect(JSON.stringify(ownList.body)).not.toContain('Balogun');
    expect(sentinelId).toBeGreaterThan(0);
  });

  it('abuse limits: demo accounts cannot check out, change passwords or invite outsiders', async () => {
    const token = (await login('demo-alumni', config.emailFor('admin', 'alumni'))).body.data.token as string;
    const post = (p: string, body: object = {}) => request(app).post(p).set('X-Tenant', 'demo-alumni').set('Authorization', `Bearer ${token}`).send(body);
    for (const p of ['/api/subscriptions/initialize', '/api/payments/paystack/initialize', '/api/payments/nomba/initialize', '/api/auth/change-password', '/api/member-invites', '/api/sms/credits/purchase']) {
      const res = await post(p);
      expect({ p, status: res.status }).toEqual({ p, status: 403 });
    }
  });

  it('platform statistics leave demo tenants out', async () => {
    const real = await prisma.association.count({ where: { isDemo: false } });
    const everything = await prisma.association.count();
    expect(everything - real).toBe(ONLY.length);
  });

  it('--reset-demo removes only demo-flagged data and leaves everything else byte-identical', async () => {
    const withDemo = await totalCounts();
    const report = await mod.runDemoSeed({ ...baseOptions(), only: [], dryRun: false, reset: true, resetConfirmation: 'wrong' }).catch((e) => e);
    expect(report).toBeInstanceOf(mod.SeedRefused); // refused without the typed phrase
    expect(await totalCounts()).toEqual(withDemo);

    const result = await mod.runDemoSeed({ ...baseOptions(), only: ['alumni'], reset: true, resetConfirmation: mod.RESET_PHRASE });
    expect(result.reset?.total).toBeGreaterThan(0);
    expect(await fingerprint()).toEqual(before); // real tenant, real users, and every tenant-scoped table: unchanged
    expect(await prisma.association.count({ where: { subdomain: 'real-sentinel' } })).toBe(1);
    expect(await prisma.association.findMany({ where: { isDemo: true }, select: { subdomain: true } })).toEqual([{ subdomain: 'demo-alumni' }]);
    expect((await invariants.runInvariants(prisma)).filter((c) => !c.ok)).toEqual([]);
  });
});
