import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TENANTS, emailFor, subdomainOf } from '../../prisma/seeds/demo/config';
import { RESET_PHRASE, SeedRefused, assertAllowed, describePlan, looksLikeProduction } from '../../prisma/seeds/demo/run';
import { makeRng, personName, phoneFor, SEED_NUMBER } from '../../prisma/seeds/demo/util';
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from '../../src/lib/demo';

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));

const REMOTE = 'postgresql://u:p@db.internal:5432/societyledger';
const LOCAL = 'postgresql://u:p@localhost:5432/scratch';
const base = { env: {} as NodeJS.ProcessEnv, databaseUrl: LOCAL, dryRun: false, reset: false, confirmBackup: false };

describe('demo seed: safety gates', () => {
  it('refuses to write without SEED_DEMO=true', () => {
    expect(() => assertAllowed({ ...base })).toThrow(SeedRefused);
    expect(() => assertAllowed({ ...base, env: { SEED_DEMO: 'true' } as never })).not.toThrow();
  });

  it('allows --dry-run without any flag, even against a remote database', () => {
    expect(() => assertAllowed({ ...base, dryRun: true, databaseUrl: REMOTE })).not.toThrow();
  });

  it('refuses a non-local database unless a backup is confirmed', () => {
    const env = { SEED_DEMO: 'true' } as never;
    expect(() => assertAllowed({ ...base, env, databaseUrl: REMOTE })).toThrow(/backup/i);
    expect(() => assertAllowed({ ...base, env, databaseUrl: REMOTE, confirmBackup: true })).not.toThrow();
  });

  it('treats NODE_ENV=production and unparseable URLs as production', () => {
    expect(looksLikeProduction({ NODE_ENV: 'production' } as never, LOCAL)).toBe(true);
    expect(looksLikeProduction({} as never, 'not a url')).toBe(true);
    expect(looksLikeProduction({} as never, LOCAL)).toBe(false);
  });

  it('--reset-demo needs the typed confirmation phrase', () => {
    const env = { SEED_DEMO: 'true' } as never;
    expect(() => assertAllowed({ ...base, env, reset: true })).toThrow(RESET_PHRASE);
    expect(() => assertAllowed({ ...base, env, reset: true, resetConfirmation: 'yes' })).toThrow(SeedRefused);
    expect(() => assertAllowed({ ...base, env, reset: true, resetConfirmation: RESET_PHRASE })).not.toThrow();
    expect(() => assertAllowed({ ...base, env: { SEED_DEMO: 'true', DEMO_RESET_CONFIRM: RESET_PHRASE } as never, reset: true })).not.toThrow();
  });
});

describe('demo seed: plan and data', () => {
  it('uses only demo-domain emails, unique per tenant', () => {
    for (const t of TENANTS) {
      const seen = new Set<string>();
      for (const p of t.personas) {
        const email = p.sharedIdentity ? `${p.sharedIdentity}@${DEMO_EMAIL_DOMAIN}` : emailFor(p.key, t.short);
        expect(isDemoEmail(email)).toBe(true);
        expect(seen.has(email)).toBe(false);
        seen.add(email);
      }
    }
  });

  it('every tenant has an admin, a unique subdomain and a plan that fits what it shows', () => {
    const subs = new Set<string>();
    for (const t of TENANTS) {
      expect(t.personas.some((p) => p.key === 'admin')).toBe(true);
      expect(subs.has(subdomainOf(t))).toBe(false);
      subs.add(subdomainOf(t));
      if (t.modules.cooperative) expect(t.planCode).toBe('enterprise'); // cooperatives are an Enterprise module
      if (t.modules.welfare || t.modules.elections || t.modules.polls) expect(['professional', 'enterprise']).toContain(t.planCode);
    }
  });

  it('covers every plan and every thrift model', () => {
    expect(new Set(TENANTS.map((t) => t.planCode))).toEqual(new Set(['starter', 'professional', 'enterprise', 'thrift-group']));
    expect(TENANTS.flatMap((t) => t.pots ?? []).map((p) => p.state).sort()).toEqual(['completed', 'in_progress', 'in_progress', 'not_started']);
    expect(TENANTS.some((t) => (t.thrift ?? []).length > 0 && t.kind === 'THRIFT_GROUP')).toBe(true);
  });

  it('puts the dual-context person in an association and a standalone thrift group', () => {
    const dual = TENANTS.filter((t) => t.personas.some((p) => p.sharedIdentity === 'amaka.dual'));
    expect(dual.map((t) => t.kind).sort()).toEqual(['ASSOCIATION', 'THRIFT_GROUP']);
  });

  it('is deterministic: the same seed gives the same names and phones', () => {
    const run = () => {
      const rng = makeRng(SEED_NUMBER);
      const taken = new Set<string>();
      return Array.from({ length: 25 }, () => ({ ...personName(rng, taken), phone: phoneFor(rng) }));
    };
    expect(run()).toEqual(run());
    expect(run().every((p) => /^0[789]\d{9}$/.test(p.phone))).toBe(true);
  });

  it('describes the plan without touching a database', () => {
    const lines = describePlan(TENANTS);
    expect(lines.at(-1)).toMatch(/Total: 8 tenants/);
  });

  it('never hard-codes a password or a hex colour in the seed module', () => {
    const dir = join(__dirname, '../../prisma/seeds/demo');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text).not.toMatch(/password\s*[:=]\s*['"][^'"$`]{6,}['"]/i);
      expect(text).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });
});

describe('demo guard middleware', () => {
  const demoLib = jest.requireMock('../../src/lib/prisma');
  void demoLib;

  const run = async (opts: { demo: boolean; method?: string; path: string; body?: unknown; headers?: Record<string, string> }) => {
    jest.resetModules();
    jest.doMock('../../src/lib/demo', () => ({ ...jest.requireActual('../../src/lib/demo'), isDemoAssociation: async () => opts.demo }));
    const { demoGuard } = await import('../../src/middleware/demo-guard.middleware');
    const res: { statusCode?: number; payload?: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
      status(n) { this.statusCode = n; return this; },
      json(b) { this.payload = b; return this; },
    };
    const next = jest.fn();
    await demoGuard({ tenantId: 7, method: opts.method ?? 'POST', path: opts.path, body: opts.body ?? {}, headers: opts.headers ?? {} } as never, res as never, next);
    return { res, next };
  };

  it('blocks gateway checkout, account changes, SMS and invites on a demo tenant', async () => {
    for (const path of ['/api/payments/paystack/initialize', '/api/payments/nomba/initialize', '/api/subscriptions/initialize', '/api/sms/credits/purchase', '/api/auth/change-password', '/api/member-invites', '/api/sms/send']) {
      const { res, next } = await run({ demo: true, path });
      expect({ path, status: res.statusCode }).toEqual({ path, status: 403 });
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('rejects a member email that is not on the demo domain, and big uploads', async () => {
    expect((await run({ demo: true, path: '/api/members', body: { email: 'someone@gmail.com' } })).res.statusCode).toBe(403);
    expect((await run({ demo: true, path: '/api/members', body: { email: `ok@${DEMO_EMAIL_DOMAIN}` } })).next).toHaveBeenCalled();
    const big = await run({ demo: true, path: '/api/cash/receipts', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(3 * 1024 * 1024) } });
    expect(big.res.statusCode).toBe(413);
  });

  it('lets reads through on a demo tenant and everything through on a real one', async () => {
    expect((await run({ demo: true, method: 'GET', path: '/api/payments/paystack/initialize' })).next).toHaveBeenCalled();
    expect((await run({ demo: false, path: '/api/payments/paystack/initialize' })).next).toHaveBeenCalled();
    expect((await run({ demo: false, path: '/api/auth/change-password' })).next).toHaveBeenCalled();
  });
});
