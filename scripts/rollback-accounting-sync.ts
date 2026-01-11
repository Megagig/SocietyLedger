/**
 * ROLLBACK SCRIPT - ACCOUNTING INTEGRATION
 * 
 * Rolls back accounting sync by:
 * - Voiding journal entries created by auto-sync
 * - Resetting accountingSynced flags to false
 * - Clearing accountingEntryId references
 * 
 * @author SocietyLedger Development Team
 * @date January 11, 2026
 * 
 * USAGE:
 *   npm run rollback:accounting -- --association-id=1
 *   npm run rollback:accounting -- --all
 *   npm run rollback:accounting -- --dry-run
 *   npm run rollback:accounting -- --date-from=2026-01-01
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

interface RollbackConfig {
  associationId?: number;
  all: boolean;
  dryRun: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

interface RollbackStats {
  journalEntries: { total: number; voided: number; failed: number };
  transactions: { total: number; reset: number; failed: number };
  payments: { total: number; reset: number; failed: number };
  welfareContributions: { total: number; reset: number; failed: number };
  welfarePayouts: { total: number; reset: number; failed: number };
  savingsTransactions: { total: number; reset: number; failed: number };
  loans: { total: number; reset: number; failed: number };
  loanRepayments: { total: number; reset: number; failed: number };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseArgs(): RollbackConfig {
  const args = process.argv.slice(2);
  const config: RollbackConfig = {
    all: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--association-id=')) {
      config.associationId = parseInt(arg.split('=')[1]);
    } else if (arg === '--all') {
      config.all = true;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--date-from=')) {
      config.dateFrom = new Date(arg.split('=')[1]);
    } else if (arg.startsWith('--date-to=')) {
      config.dateTo = new Date(arg.split('=')[1]);
    }
  }

  return config;
}

function printStats(stats: RollbackStats) {
  console.log('\n' + '='.repeat(60));
  console.log('ROLLBACK STATISTICS');
  console.log('='.repeat(60));
  
  console.log(`\nJournal Entries:`);
  console.log(`  Total:  ${stats.journalEntries.total}`);
  console.log(`  Voided: ${stats.journalEntries.voided} ✓`);
  console.log(`  Failed: ${stats.journalEntries.failed} ✗`);

  const modules = [
    { name: 'Transactions', data: stats.transactions },
    { name: 'Payments', data: stats.payments },
    { name: 'Welfare Contributions', data: stats.welfareContributions },
    { name: 'Welfare Payouts', data: stats.welfarePayouts },
    { name: 'Savings Transactions', data: stats.savingsTransactions },
    { name: 'Loans', data: stats.loans },
    { name: 'Loan Repayments', data: stats.loanRepayments },
  ];

  for (const module of modules) {
    console.log(`\n${module.name}:`);
    console.log(`  Total: ${module.data.total}`);
    console.log(`  Reset: ${module.data.reset} ✓`);
    console.log(`  Failed: ${module.data.failed} ✗`);
  }

  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalReset = Object.values(stats).reduce((sum, s) => sum + (s.reset || s.voided || 0), 0);
  const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);

  console.log('\n' + '-'.repeat(60));
  console.log(`OVERALL TOTALS:`);
  console.log(`  Total Records: ${totalRecords}`);
  console.log(`  Reset/Voided:  ${totalReset} ✓`);
  console.log(`  Failed:        ${totalFailed} ✗`);
  console.log('='.repeat(60) + '\n');
}

// ============================================
// ROLLBACK FUNCTIONS
// ============================================

async function voidJournalEntries(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n📋 Voiding auto-synced journal entries for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    status: 'POSTED',
    description: { contains: 'auto_sync' }, // Entries created by auto-sync
  };

  if (config.dateFrom) {
    whereClause.entryDate = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.entryDate = { ...whereClause.entryDate, lte: config.dateTo };
  }

  const entries = await prisma.journalEntry.findMany({
    where: whereClause,
  });

  stats.journalEntries.total = entries.length;
  console.log(`  Found ${entries.length} journal entries to void`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would void ${entries.length} journal entries`);
    return;
  }

  for (const entry of entries) {
    try {
      await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
          status: 'VOIDED',
          description: `${entry.description} [VOIDED BY ROLLBACK]`,
        },
      });
      stats.journalEntries.voided++;
      console.log(`  ✓ Voided journal entry ${entry.entryNumber}`);
    } catch (error: any) {
      stats.journalEntries.failed++;
      console.error(`  ✗ Failed to void entry ${entry.id}:`, error.message);
    }
  }
}

async function resetTransactions(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n📝 Resetting transaction sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.createdAt = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.createdAt = { ...whereClause.createdAt, lte: config.dateTo };
  }

  const synced = await prisma.transaction.findMany({ where: whereClause });
  stats.transactions.total = synced.length;
  console.log(`  Found ${synced.length} synced transactions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} transactions`);
    return;
  }

  try {
    const result = await prisma.transaction.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.transactions.reset = result.count;
    console.log(`  ✓ Reset ${result.count} transactions`);
  } catch (error: any) {
    stats.transactions.failed = synced.length;
    console.error(`  ✗ Failed to reset transactions:`, error.message);
  }
}

async function resetPayments(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n💰 Resetting payment sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.paymentDate = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.paymentDate = { ...whereClause.paymentDate, lte: config.dateTo };
  }

  const synced = await prisma.payment.findMany({ where: whereClause });
  stats.payments.total = synced.length;
  console.log(`  Found ${synced.length} synced payments`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} payments`);
    return;
  }

  try {
    const result = await prisma.payment.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.payments.reset = result.count;
    console.log(`  ✓ Reset ${result.count} payments`);
  } catch (error: any) {
    stats.payments.failed = synced.length;
    console.error(`  ✗ Failed to reset payments:`, error.message);
  }
}

async function resetWelfareContributions(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n🤝 Resetting welfare contribution sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.contributionDate = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.contributionDate = { ...whereClause.contributionDate, lte: config.dateTo };
  }

  const synced = await prisma.welfareContribution.findMany({ where: whereClause });
  stats.welfareContributions.total = synced.length;
  console.log(`  Found ${synced.length} synced welfare contributions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} welfare contributions`);
    return;
  }

  try {
    const result = await prisma.welfareContribution.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.welfareContributions.reset = result.count;
    console.log(`  ✓ Reset ${result.count} welfare contributions`);
  } catch (error: any) {
    stats.welfareContributions.failed = synced.length;
    console.error(`  ✗ Failed to reset welfare contributions:`, error.message);
  }
}

async function resetWelfarePayouts(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n💸 Resetting welfare payout sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.disbursedAt = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.disbursedAt = { ...whereClause.disbursedAt, lte: config.dateTo };
  }

  const synced = await prisma.welfarePayoutRequest.findMany({ where: whereClause });
  stats.welfarePayouts.total = synced.length;
  console.log(`  Found ${synced.length} synced welfare payouts`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} welfare payouts`);
    return;
  }

  try {
    const result = await prisma.welfarePayoutRequest.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.welfarePayouts.reset = result.count;
    console.log(`  ✓ Reset ${result.count} welfare payouts`);
  } catch (error: any) {
    stats.welfarePayouts.failed = synced.length;
    console.error(`  ✗ Failed to reset welfare payouts:`, error.message);
  }
}

async function resetSavingsTransactions(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n💵 Resetting savings transaction sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.transactionDate = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.transactionDate = { ...whereClause.transactionDate, lte: config.dateTo };
  }

  const synced = await prisma.savingsTransaction.findMany({ where: whereClause });
  stats.savingsTransactions.total = synced.length;
  console.log(`  Found ${synced.length} synced savings transactions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} savings transactions`);
    return;
  }

  try {
    const result = await prisma.savingsTransaction.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.savingsTransactions.reset = result.count;
    console.log(`  ✓ Reset ${result.count} savings transactions`);
  } catch (error: any) {
    stats.savingsTransactions.failed = synced.length;
    console.error(`  ✗ Failed to reset savings transactions:`, error.message);
  }
}

async function resetLoans(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n🏦 Resetting loan sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.disbursedAt = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.disbursedAt = { ...whereClause.disbursedAt, lte: config.dateTo };
  }

  const synced = await prisma.loan.findMany({ where: whereClause });
  stats.loans.total = synced.length;
  console.log(`  Found ${synced.length} synced loans`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} loans`);
    return;
  }

  try {
    const result = await prisma.loan.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.loans.reset = result.count;
    console.log(`  ✓ Reset ${result.count} loans`);
  } catch (error: any) {
    stats.loans.failed = synced.length;
    console.error(`  ✗ Failed to reset loans:`, error.message);
  }
}

async function resetLoanRepayments(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n💳 Resetting loan repayment sync flags for association ${associationId}...`);

  const whereClause: any = {
    associationId,
    accountingSynced: true,
  };

  if (config.dateFrom) {
    whereClause.paymentDate = { gte: config.dateFrom };
  }
  if (config.dateTo) {
    whereClause.paymentDate = { ...whereClause.paymentDate, lte: config.dateTo };
  }

  const synced = await prisma.loanRepayment.findMany({ where: whereClause });
  stats.loanRepayments.total = synced.length;
  console.log(`  Found ${synced.length} synced loan repayments`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would reset ${synced.length} loan repayments`);
    return;
  }

  try {
    const result = await prisma.loanRepayment.updateMany({
      where: whereClause,
      data: {
        accountingSynced: false,
        accountingEntryId: null,
      },
    });
    stats.loanRepayments.reset = result.count;
    console.log(`  ✓ Reset ${result.count} loan repayments`);
  } catch (error: any) {
    stats.loanRepayments.failed = synced.length;
    console.error(`  ✗ Failed to reset loan repayments:`, error.message);
  }
}

// ============================================
// MAIN ROLLBACK FUNCTION
// ============================================

async function rollbackAssociation(
  associationId: number,
  config: RollbackConfig,
  stats: RollbackStats
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ROLLING BACK ASSOCIATION: ${associationId}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Void journal entries first
  await voidJournalEntries(associationId, config, stats);

  // Reset all sync flags
  await resetTransactions(associationId, config, stats);
  await resetPayments(associationId, config, stats);
  await resetWelfareContributions(associationId, config, stats);
  await resetWelfarePayouts(associationId, config, stats);
  await resetSavingsTransactions(associationId, config, stats);
  await resetLoans(associationId, config, stats);
  await resetLoanRepayments(associationId, config, stats);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Rollback completed for association ${associationId} in ${duration}s`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('ACCOUNTING INTEGRATION - ROLLBACK');
  console.log('='.repeat(60));

  const config = parseArgs();

  // Validate configuration
  if (!config.all && !config.associationId) {
    console.error('\n❌ Error: Must specify --association-id=<id> or --all');
    console.log('\nUsage:');
    console.log('  npm run rollback:accounting -- --association-id=1');
    console.log('  npm run rollback:accounting -- --all');
    console.log('  npm run rollback:accounting -- --dry-run --association-id=1');
    console.log('  npm run rollback:accounting -- --date-from=2026-01-01 --association-id=1');
    process.exit(1);
  }

  if (config.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  console.log('\nConfiguration:');
  console.log(`  Association ID: ${config.associationId || 'ALL'}`);
  console.log(`  Dry Run:        ${config.dryRun}`);
  console.log(`  Date From:      ${config.dateFrom?.toISOString() || 'N/A'}`);
  console.log(`  Date To:        ${config.dateTo?.toISOString() || 'N/A'}`);

  // Confirm rollback
  if (!config.dryRun) {
    console.log('\n⚠️  WARNING: This will void journal entries and reset sync flags!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const stats: RollbackStats = {
    journalEntries: { total: 0, voided: 0, failed: 0 },
    transactions: { total: 0, reset: 0, failed: 0 },
    payments: { total: 0, reset: 0, failed: 0 },
    welfareContributions: { total: 0, reset: 0, failed: 0 },
    welfarePayouts: { total: 0, reset: 0, failed: 0 },
    savingsTransactions: { total: 0, reset: 0, failed: 0 },
    loans: { total: 0, reset: 0, failed: 0 },
    loanRepayments: { total: 0, reset: 0, failed: 0 },
  };

  try {
    if (config.all) {
      // Rollback all associations
      const associations = await prisma.association.findMany({
        select: { id: true, name: true },
      });

      console.log(`\nFound ${associations.length} associations`);

      for (const association of associations) {
        await rollbackAssociation(association.id, config, stats);
      }
    } else {
      // Rollback single association
      await rollbackAssociation(config.associationId!, config, stats);
    }

    // Print final statistics
    printStats(stats);

    console.log('✅ Rollback completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run rollback
main();
