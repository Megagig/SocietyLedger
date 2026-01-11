/**
 * DATA MIGRATION SCRIPT - ACCOUNTING INTEGRATION
 * 
 * Migrates existing unsynced financial records to the accounting system.
 * This script syncs:
 * - Transactions (Finance module)
 * - Payments (Finance module)
 * - Welfare Contributions
 * - Welfare Payouts
 * - Savings Transactions
 * - Loans
 * - Loan Repayments
 * 
 * @author SocietyLedger Development Team
 * @date January 11, 2026
 * 
 * USAGE:
 *   npm run migrate:accounting -- --association-id=1
 *   npm run migrate:accounting -- --all
 *   npm run migrate:accounting -- --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { accountingIntegrationService } from '../apps/api/src/services/accounting-integration.service';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

interface MigrationConfig {
  associationId?: number;
  all: boolean;
  dryRun: boolean;
  batchSize: number;
  delayMs: number;
}

interface MigrationStats {
  transactions: { total: number; synced: number; failed: number };
  payments: { total: number; synced: number; failed: number };
  welfareContributions: { total: number; synced: number; failed: number };
  welfarePayouts: { total: number; synced: number; failed: number };
  savingsTransactions: { total: number; synced: number; failed: number };
  loans: { total: number; synced: number; failed: number };
  loanRepayments: { total: number; synced: number; failed: number };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    all: false,
    dryRun: false,
    batchSize: 50,
    delayMs: 100,
  };

  for (const arg of args) {
    if (arg.startsWith('--association-id=')) {
      config.associationId = parseInt(arg.split('=')[1]);
    } else if (arg === '--all') {
      config.all = true;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delay=')) {
      config.delayMs = parseInt(arg.split('=')[1]);
    }
  }

  return config;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printStats(stats: MigrationStats) {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION STATISTICS');
  console.log('='.repeat(60));
  
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
    const successRate = module.data.total > 0 
      ? ((module.data.synced / module.data.total) * 100).toFixed(1)
      : '0.0';
    
    console.log(`\n${module.name}:`);
    console.log(`  Total:   ${module.data.total}`);
    console.log(`  Synced:  ${module.data.synced} ✓`);
    console.log(`  Failed:  ${module.data.failed} ✗`);
    console.log(`  Success: ${successRate}%`);
  }

  const totalRecords = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalSynced = Object.values(stats).reduce((sum, s) => sum + s.synced, 0);
  const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);
  const overallSuccess = totalRecords > 0 
    ? ((totalSynced / totalRecords) * 100).toFixed(1)
    : '0.0';

  console.log('\n' + '-'.repeat(60));
  console.log(`OVERALL TOTALS:`);
  console.log(`  Total Records: ${totalRecords}`);
  console.log(`  Synced:        ${totalSynced} ✓`);
  console.log(`  Failed:        ${totalFailed} ✗`);
  console.log(`  Success Rate:  ${overallSuccess}%`);
  console.log('='.repeat(60) + '\n');
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateTransactions(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n📝 Migrating Transactions for association ${associationId}...`);

  const unsynced = await prisma.transaction.findMany({
    where: {
      associationId,
      accountingSynced: false,
      status: { not: 'voided' }, // Skip voided transactions
    },
    include: {
      category: true,
      member: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  stats.transactions.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced transactions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} transactions`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const txn = unsynced[i];
    try {
      await accountingIntegrationService.onTransactionCreated(txn, 1);
      stats.transactions.synced++;
      console.log(`  ✓ Synced transaction ${txn.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.transactions.failed++;
      console.error(`  ✗ Failed transaction ${txn.id}:`, error.message);
    }

    // Delay between batches
    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migratePayments(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n💰 Migrating Payments for association ${associationId}...`);

  const unsynced = await prisma.payment.findMany({
    where: {
      associationId,
      accountingSynced: false,
    },
    include: {
      transaction: {
        include: {
          category: true,
          member: true,
        },
      },
    },
    orderBy: { paymentDate: 'asc' },
  });

  stats.payments.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced payments`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} payments`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const payment = unsynced[i];
    try {
      await accountingIntegrationService.onPaymentRecorded(payment, 1);
      stats.payments.synced++;
      console.log(`  ✓ Synced payment ${payment.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.payments.failed++;
      console.error(`  ✗ Failed payment ${payment.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migrateWelfareContributions(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n🤝 Migrating Welfare Contributions for association ${associationId}...`);

  const unsynced = await prisma.welfareContribution.findMany({
    where: {
      associationId,
      accountingSynced: false,
      status: 'CONFIRMED',
    },
    include: {
      fund: true, // Include the fund relation
    },
    orderBy: { contributionDate: 'asc' },
  });

  stats.welfareContributions.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced welfare contributions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} welfare contributions`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const contribution = unsynced[i];
    try {
      await accountingIntegrationService.onWelfareContributionConfirmed(
        contribution,
        contribution.fund,
        1
      );
      stats.welfareContributions.synced++;
      console.log(`  ✓ Synced contribution ${contribution.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.welfareContributions.failed++;
      console.error(`  ✗ Failed contribution ${contribution.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migrateWelfarePayouts(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n💸 Migrating Welfare Payouts for association ${associationId}...`);

  const unsynced = await prisma.welfarePayoutRequest.findMany({
    where: {
      associationId,
      accountingSynced: false,
      status: 'DISBURSED',
    },
    include: {
      fund: true, // Include the fund relation
    },
    orderBy: { disbursedAt: 'asc' },
  });

  stats.welfarePayouts.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced welfare payouts`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} welfare payouts`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const payout = unsynced[i];
    try {
      await accountingIntegrationService.onWelfarePayoutDisbursed(
        payout,
        payout.fund,
        1
      );
      stats.welfarePayouts.synced++;
      console.log(`  ✓ Synced payout ${payout.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.welfarePayouts.failed++;
      console.error(`  ✗ Failed payout ${payout.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migrateSavingsTransactions(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n💵 Migrating Savings Transactions for association ${associationId}...`);

  const unsynced = await prisma.savingsTransaction.findMany({
    where: {
      associationId,
      accountingSynced: false,
      // No status field in SavingsTransaction model
    },
    include: {
      savingsAccount: true, // Correct relation name
    },
    orderBy: { createdAt: 'asc' }, // Use createdAt instead of transactionDate for ordering
  });

  stats.savingsTransactions.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced savings transactions`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} savings transactions`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const txn = unsynced[i];
    try {
      if (txn.type === 'DEPOSIT') {
        await accountingIntegrationService.onSavingsDeposit(txn, txn.savingsAccount, 1);
      } else if (txn.type === 'WITHDRAWAL') {
        await accountingIntegrationService.onSavingsWithdrawal(txn, txn.savingsAccount, 1);
      }
      stats.savingsTransactions.synced++;
      console.log(`  ✓ Synced savings ${txn.type} ${txn.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.savingsTransactions.failed++;
      console.error(`  ✗ Failed savings transaction ${txn.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migrateLoans(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n🏦 Migrating Loans for association ${associationId}...`);

  const unsynced = await prisma.loan.findMany({
    where: {
      associationId,
      accountingSynced: false,
      status: { in: ['ACTIVE', 'PAID_OFF', 'DEFAULTED'] }, // Correct enum values
    },
    include: {
      application: true, // Include the application relation
    },
    orderBy: { disbursedAt: 'asc' },
  });

  stats.loans.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced loans`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} loans`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const loan = unsynced[i];
    try {
      await accountingIntegrationService.onLoanDisbursed(loan, loan.application, 1);
      stats.loans.synced++;
      console.log(`  ✓ Synced loan ${loan.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.loans.failed++;
      console.error(`  ✗ Failed loan ${loan.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

async function migrateLoanRepayments(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n💳 Migrating Loan Repayments for association ${associationId}...`);

  const unsynced = await prisma.loanRepayment.findMany({
    where: {
      associationId,
      accountingSynced: false,
    },
    include: {
      loan: true, // Include the loan relation
    },
    orderBy: { paidAt: 'asc' }, // Use paidAt instead of paymentDate
  });

  stats.loanRepayments.total = unsynced.length;
  console.log(`  Found ${unsynced.length} unsynced loan repayments`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would sync ${unsynced.length} loan repayments`);
    return;
  }

  for (let i = 0; i < unsynced.length; i++) {
    const repayment = unsynced[i];
    try {
      await accountingIntegrationService.onLoanRepayment(repayment, repayment.loan, 1);
      stats.loanRepayments.synced++;
      console.log(`  ✓ Synced repayment ${repayment.id} (${i + 1}/${unsynced.length})`);
    } catch (error: any) {
      stats.loanRepayments.failed++;
      console.error(`  ✗ Failed repayment ${repayment.id}:`, error.message);
    }

    if ((i + 1) % config.batchSize === 0) {
      console.log(`  Processed ${i + 1}/${unsynced.length}, pausing...`);
      await delay(config.delayMs);
    }
  }
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function migrateAssociation(
  associationId: number,
  config: MigrationConfig,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`MIGRATING ASSOCIATION: ${associationId}`);
  console.log('='.repeat(60));

  // Check if accounting is initialized
  const hasAccounting = await accountingIntegrationService.checkAccountingInitialized(associationId);
  if (!hasAccounting) {
    console.log(`⚠️  Accounting not initialized for association ${associationId}`);
    console.log(`   Skipping migration. Please initialize chart of accounts first.`);
    console.log(`   Tip: Check if ChartOfAccount records exist for this association.`);
    return;
  }

  const startTime = Date.now();

  // Migrate all modules
  await migrateTransactions(associationId, config, stats);
  await migratePayments(associationId, config, stats);
  await migrateWelfareContributions(associationId, config, stats);
  await migrateWelfarePayouts(associationId, config, stats);
  await migrateSavingsTransactions(associationId, config, stats);
  await migrateLoans(associationId, config, stats);
  await migrateLoanRepayments(associationId, config, stats);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Migration completed for association ${associationId} in ${duration}s`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('ACCOUNTING INTEGRATION - DATA MIGRATION');
  console.log('='.repeat(60));

  const config = parseArgs();

  // Validate configuration
  if (!config.all && !config.associationId) {
    console.error('\n❌ Error: Must specify --association-id=<id> or --all');
    console.log('\nUsage:');
    console.log('  npm run migrate:accounting -- --association-id=1');
    console.log('  npm run migrate:accounting -- --all');
    console.log('  npm run migrate:accounting -- --dry-run --association-id=1');
    process.exit(1);
  }

  if (config.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  console.log('\nConfiguration:');
  console.log(`  Association ID: ${config.associationId || 'ALL'}`);
  console.log(`  Dry Run:        ${config.dryRun}`);
  console.log(`  Batch Size:     ${config.batchSize}`);
  console.log(`  Delay (ms):     ${config.delayMs}`);

  const stats: MigrationStats = {
    transactions: { total: 0, synced: 0, failed: 0 },
    payments: { total: 0, synced: 0, failed: 0 },
    welfareContributions: { total: 0, synced: 0, failed: 0 },
    welfarePayouts: { total: 0, synced: 0, failed: 0 },
    savingsTransactions: { total: 0, synced: 0, failed: 0 },
    loans: { total: 0, synced: 0, failed: 0 },
    loanRepayments: { total: 0, synced: 0, failed: 0 },
  };

  try {
    if (config.all) {
      // Migrate all associations
      const associations = await prisma.association.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
      });

      console.log(`\nFound ${associations.length} active associations`);

      for (const association of associations) {
        await migrateAssociation(association.id, config, stats);
      }
    } else {
      // Migrate single association
      await migrateAssociation(config.associationId!, config, stats);
    }

    // Print final statistics
    printStats(stats);

    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
