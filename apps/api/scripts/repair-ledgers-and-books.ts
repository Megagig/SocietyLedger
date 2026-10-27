/**
 * Repairs every association's member ledgers and books so they agree with charges and payments (see services/ledger-books-repair.service.ts).
 *
 * Runs on every API start (docker-entrypoint.sh) and is safe to repeat: it only adds what is missing, never edits a posted entry, and a second
 * run finds nothing to do. Set REPAIR_BOOKS_ON_START=false to skip it at start.
 *
 *   pnpm --filter api repair:books                 repair every association
 *   pnpm --filter api repair:books -- --dry-run    only report what would change
 *   pnpm --filter api repair:books -- --association=12
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import { repairAllAssociations } from '../src/services/ledger-books-repair.service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const only = args.find((a) => a.startsWith('--association='));
  const onlyAssociationId = only ? Number(only.split('=')[1]) : undefined;

  const started = Date.now();
  const reports = await repairAllAssociations({ dryRun, onlyAssociationId });

  let changed = 0;
  let needAttention = 0;
  for (const r of reports) {
    const touched = r.ledger.created + r.ledger.removed + r.ledger.updated + r.books.orphansReversed + r.books.correctionsPosted;
    if (touched > 0) changed += 1;
    if (r.problems.length > 0) needAttention += 1;
    if (touched > 0 || r.problems.length > 0) {
      console.log(
        `[repair] ${r.slug} (#${r.associationId}): ledger +${r.ledger.created} -${r.ledger.removed} ~${r.ledger.updated} across ${r.ledger.membersChanged} member(s); ` +
          `books: ${r.books.correctionsPosted} correction(s), ${r.books.orphansReversed} reversal(s)${r.books.initialised ? '' : ' (no books)'}`,
      );
      for (const problem of r.problems) console.log(`[repair]   ! ${problem}`);
    }
  }
  console.log(
    `[repair] ${dryRun ? 'DRY RUN: ' : ''}${reports.length} association(s) checked in ${((Date.now() - started) / 1000).toFixed(1)}s; ` +
      `${changed} ${dryRun ? 'would change' : 'changed'}, ${needAttention} need attention.`,
  );
}

main()
  .catch((error) => {
    console.error('[repair] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
