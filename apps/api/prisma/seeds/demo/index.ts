/**
 * One-time demo-data seed.   pnpm -F @societyledger/api seed:demo -- [--dry-run] [--reset-demo] [--confirm-backup]
 * Read DEMO_SEED.md at the repo root before running this against a real database.
 *
 * Every outgoing sender (email, SMS, push, in-app dispatch) is replaced with a no-op before any service loads, whatever the database
 * says, so seeding can never message anyone.
 */
import '../_demo-stubs';
import dotenv from 'dotenv';
import { createInterface } from 'readline';
import { resolve } from 'path';

dotenv.config();

import prisma from '../../../src/lib/prisma';
import { RESET_PHRASE, SeedRefused, runDemoSeed } from './run';

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((done) => rl.question(question, (answer) => { rl.close(); done(answer); }));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const flag = (name: string) => args.has(name);
  const valueOf = (name: string) => process.argv.slice(2).find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
  const dryRun = flag('--dry-run');
  const reset = flag('--reset-demo');
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) throw new SeedRefused('DATABASE_URL is not set.');

  let resetConfirmation: string | undefined;
  if (reset && !dryRun && process.env.SEED_DEMO === 'true' && !process.env.DEMO_RESET_CONFIRM && process.stdin.isTTY) {
    resetConfirmation = await ask(`This deletes every demo-flagged record, then re-seeds. Type "${RESET_PHRASE}" to continue: `);
  }

  const report = await runDemoSeed({
    prisma,
    env: process.env,
    databaseUrl,
    dryRun,
    reset,
    confirmBackup: flag('--confirm-backup'),
    resetConfirmation,
    credentialsPath: resolve(valueOf('--credentials-out') ?? 'demo-accounts.local.md'),
    appUrl: process.env.DEMO_APP_URL || process.env.APP_URL || 'https://societyledger.com.ng',
    log: (m) => console.log(m),
    only: valueOf('--only')?.split(','),
  });
  console.log(`\nResult: ${report.status}${report.accounts ? `, ${report.accounts} accounts` : ''}`);
  if (report.status === 'applied') console.log(JSON.stringify(report.counts, null, 2));
}

main()
  .catch((error) => {
    if (error instanceof SeedRefused) console.error(`\n${error.message}\n`);
    else console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
