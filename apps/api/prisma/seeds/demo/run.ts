/**
 * The demo seed, end to end: safety gates, plan, seed, integrity checks, seed marker, credentials sheet.
 * `prisma/seeds/demo/index.ts` is the command-line wrapper; the tests call `runDemoSeed` directly.
 */
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { resetDemoCache } from '../../../src/lib/demo';
import { SEED_KEY, SEED_VERSION, TENANTS, TenantDef } from './config';
import { Ctx, Tenant, ensureTenant } from './core';
import { Counts, seedFinance } from './finance';
import { seedMeetings, seedMessages, seedVoting, seedWelfare } from './community';
import { seedCooperative } from './cooperative';
import { ensureAjoAccess, seedPot, seedThrift } from './ajo';
import { Check, assertAllPass, runInvariants } from './invariants';
import { resetDemo } from './reset';
import { writeCredentialsSheet } from './credentials';
import { SEED_NUMBER, makeRng, startOfToday } from './util';

export interface RunOptions {
  prisma: PrismaClient;
  env: NodeJS.ProcessEnv;
  databaseUrl: string;
  dryRun: boolean;
  reset: boolean;
  confirmBackup: boolean;
  /** For --reset-demo: the confirmation the operator typed (or DEMO_RESET_CONFIRM). */
  resetConfirmation?: string;
  credentialsPath: string;
  appUrl: string;
  log?: (message: string) => void;
  /** Only these tenants (tests use a small set to stay fast). */
  only?: string[];
}

export interface RunReport {
  status: 'applied' | 'already-applied' | 'dry-run' | 'reset-only';
  counts: Record<string, Counts>;
  checks: Check[];
  accounts: number;
  reset?: { total: number };
}

export const RESET_PHRASE = 'DELETE DEMO DATA';

/** A database is treated as production unless it is clearly on this machine. */
export function looksLikeProduction(env: NodeJS.ProcessEnv, databaseUrl: string): boolean {
  if (env.NODE_ENV === 'production') return true;
  try {
    const host = new URL(databaseUrl).hostname;
    return !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return true;
  }
}

export class SeedRefused extends Error {}

export function assertAllowed(opts: Pick<RunOptions, 'env' | 'databaseUrl' | 'dryRun' | 'reset' | 'confirmBackup' | 'resetConfirmation'>): { production: boolean } {
  const production = looksLikeProduction(opts.env, opts.databaseUrl);
  if (opts.dryRun) return { production };
  if (opts.env.SEED_DEMO !== 'true') throw new SeedRefused('Refusing to run: set SEED_DEMO=true to seed demo data. (Use --dry-run to see the plan without it.)');
  if (production && !opts.confirmBackup) {
    throw new SeedRefused('Refusing to run against this database: it does not look like a local one. Take a backup first (see DEMO_SEED.md, "Back up first"), then re-run with --confirm-backup.');
  }
  if (opts.reset) {
    const typed = (opts.resetConfirmation ?? opts.env.DEMO_RESET_CONFIRM ?? '').trim();
    if (typed !== RESET_PHRASE) throw new SeedRefused(`--reset-demo deletes every demo-flagged record. To confirm, type "${RESET_PHRASE}" at the prompt (or set DEMO_RESET_CONFIRM="${RESET_PHRASE}").`);
  }
  return { production };
}

export function describePlan(tenants: TenantDef[]): string[] {
  const lines: string[] = [];
  let logins = 0;
  for (const t of tenants) {
    const mods = Object.entries(t.modules).filter(([, v]) => v).map(([k]) => k);
    lines.push(`${t.short.padEnd(10)} ${t.name} [${t.kind === 'THRIFT_GROUP' ? 'thrift group' : 'association'}, ${t.planCode}]`);
    lines.push(`    ${t.personas.length} logins, ${t.members || 'n/a'} member records, modules: ${mods.join(', ') || 'none'}`);
    for (const p of t.pots ?? []) lines.push(`    rotating circle: ${p.name} (${p.members} people, ${p.state})`);
    for (const p of t.thrift ?? []) lines.push(`    collector thrift: ${p.name} (${p.savers} savers, ${p.days} days)`);
    logins += t.personas.length;
  }
  lines.push(`Total: ${tenants.length} tenants, ${logins} logins.`);
  return lines;
}

const generatePassword = () => `Demo-${randomBytes(9).toString('base64').replace(/[+/=]/g, 'x')}-${randomBytes(2).toString('hex')}`;

export async function runDemoSeed(opts: RunOptions): Promise<RunReport> {
  const log = opts.log ?? (() => undefined);
  const { prisma } = opts;
  const tenantsToSeed = TENANTS.filter((t) => !opts.only || opts.only.includes(t.short));
  const empty: RunReport = { status: 'dry-run', counts: {}, checks: [], accounts: 0 };

  const { production } = assertAllowed(opts);
  log(`Database: ${production ? 'REMOTE / PRODUCTION (backup confirmed)' : 'local'}`);

  if (opts.dryRun) {
    describePlan(tenantsToSeed).forEach(log);
    const existing = await prisma.systemSeed.findUnique({ where: { key_version: { key: SEED_KEY, version: SEED_VERSION } } });
    log(existing ? `The demo seed v${SEED_VERSION} is already applied (${existing.appliedAt.toISOString()}): a real run would change nothing.` : `A real run would apply the demo seed v${SEED_VERSION}.`);
    if (opts.reset) {
      const r = await resetDemo(prisma, { dryRun: true });
      log(`--reset-demo would delete ${r.total} rows from ${Object.keys(r.deleted).length} tables (demo-flagged only).`);
    }
    return empty;
  }

  if (tenantsToSeed.some((t) => t.pots?.length || t.thrift?.length) && (opts.env.TOTP_ENCRYPTION_KEY ?? '').length < 32) {
    throw new SeedRefused('TOTP_ENCRYPTION_KEY must be set (at least 32 characters): Ajo encrypts group bank details with it. Use the same value as the API service.');
  }

  let resetTotal: number | undefined;
  if (opts.reset) {
    log('Resetting: deleting demo-flagged records only...');
    const r = await resetDemo(prisma);
    resetTotal = r.total;
    resetDemoCache();
    log(`Deleted ${r.total} rows from ${Object.keys(r.deleted).length} tables.`);
  }

  const applied = await prisma.systemSeed.findUnique({ where: { key_version: { key: SEED_KEY, version: SEED_VERSION } } });
  if (applied) {
    log(`The demo seed v${SEED_VERSION} was already applied on ${applied.appliedAt.toISOString()}. Nothing was changed. (Use --reset-demo to rebuild it.)`);
    return { ...empty, status: 'already-applied' };
  }
  const leftover = await prisma.association.count({ where: { isDemo: true } });
  if (leftover > 0) {
    throw new SeedRefused(`Found ${leftover} demo tenant(s) from an earlier run that did not finish. Run again with --reset-demo to clear them and start clean.`);
  }
  if (opts.reset && opts.only) log('(only the selected tenants will be seeded)');

  const passwordFromEnv = Boolean(opts.env.DEMO_PASSWORD);
  const password = opts.env.DEMO_PASSWORD || generatePassword();
  if (password.length < 10) throw new SeedRefused('DEMO_PASSWORD must be at least 10 characters.');
  const ctx: Ctx = { prisma, today: startOfToday(), password, passwordHash: await bcrypt.hash(password, 12), rng: makeRng(SEED_NUMBER), log };

  const counts: Record<string, Counts> = {};
  const tenants: Tenant[] = [];
  const merge = (name: string, c: Counts) => { counts[name] = { ...(counts[name] ?? {}) }; for (const [k, v] of Object.entries(c)) counts[name][k] = (counts[name][k] ?? 0) + v; };

  for (const def of tenantsToSeed) {
    log(`\n== ${def.name} ==`);
    const t = await ensureTenant(ctx, def);
    resetDemoCache();
    tenants.push(t);
    log(`   ${t.accounts.length} logins, ${t.roll.length} member records`);
    if (def.modules.dues) { merge(def.short, await seedFinance(ctx, t)); log('   finance done'); }
    if (def.modules.meetings) merge(def.short, await seedMeetings(ctx, t));
    if (def.modules.elections || def.modules.polls) merge(def.short, await seedVoting(ctx, t));
    if (def.modules.welfare) merge(def.short, await seedWelfare(ctx, t));
    if (def.modules.cooperative) merge(def.short, await seedCooperative(ctx, t));
    if (def.pots?.length || def.thrift?.length) await ensureAjoAccess(ctx, t);
    const used = new Set<number>();
    // Oldest first: a person's payout account is set up for their earliest circle and reused after that.
    const potOrder = { completed: 0, in_progress: 1, not_started: 2 } as const;
    for (const pot of [...(def.pots ?? [])].sort((x, y) => potOrder[x.state] - potOrder[y.state])) { merge(def.short, await seedPot(ctx, t, pot, used)); log(`   circle done: ${pot.name}`); }
    for (const th of def.thrift ?? []) { merge(def.short, await seedThrift(ctx, t, th)); log(`   thrift done: ${th.name}`); }
    merge(def.short, await seedMessages(ctx, t));
  }

  log('\nChecking integrity...');
  const checks = await runInvariants(prisma);
  for (const c of checks) log(`   ${c.ok ? 'PASS' : 'FAIL'}  ${c.name} (${c.detail})`);
  assertAllPass(checks);

  await prisma.systemSeed.create({ data: { key: SEED_KEY, version: SEED_VERSION, summary: { counts, tenants: tenants.map((t) => t.def.short), accounts: tenants.reduce((n, t) => n + t.accounts.length, 0) } as never } });
  writeCredentialsSheet(opts.credentialsPath, tenants, password, passwordFromEnv, opts.appUrl);
  log(`\nCredentials sheet written to ${opts.credentialsPath} (not printed). Keep it out of git and CI logs.`);
  return { status: 'applied', counts, checks, accounts: tenants.reduce((n, t) => n + t.accounts.length, 0), reset: resetTotal === undefined ? undefined : { total: resetTotal } };
}
