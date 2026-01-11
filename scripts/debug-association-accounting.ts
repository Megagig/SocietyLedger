/**
 * DEBUG ASSOCIATION ACCOUNTING
 * 
 * Detailed diagnostic for a specific association's accounting status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const associationId = parseInt(process.argv[2]);

  if (!associationId) {
    console.error('Usage: npm run debug:accounting -- <association-id>');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`ACCOUNTING DEBUG - ASSOCIATION ${associationId}`);
  console.log('='.repeat(60) + '\n');

  // Check association exists
  const association = await prisma.association.findUnique({
    where: { id: associationId },
  });

  if (!association) {
    console.log('❌ Association not found!');
    process.exit(1);
  }

  console.log(`Association: ${association.name}`);
  console.log(`Status: ${association.status}`);
  console.log('');

  // Check chart of accounts
  const accountCount = await prisma.chartOfAccount.count({
    where: { associationId },
  });

  console.log(`Chart of Accounts:`);
  console.log(`  Total Accounts: ${accountCount}`);

  if (accountCount > 0) {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { associationId },
      select: { code: true, name: true, type: true, isActive: true },
      orderBy: { code: 'asc' },
      take: 10,
    });

    console.log(`  Sample Accounts (first 10):`);
    for (const account of accounts) {
      console.log(`    ${account.code} - ${account.name} (${account.type}) ${account.isActive ? '✓' : '✗'}`);
    }
  } else {
    console.log(`  ❌ No accounts found!`);
  }

  console.log('');

  // Check journal entries
  const entryCount = await prisma.journalEntry.count({
    where: { associationId },
  });

  console.log(`Journal Entries:`);
  console.log(`  Total Entries: ${entryCount}`);

  if (entryCount > 0) {
    const entries = await prisma.journalEntry.findMany({
      where: { associationId },
      select: { entryNumber: true, status: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`  Recent Entries (last 5):`);
    for (const entry of entries) {
      console.log(`    ${entry.entryNumber} - ${entry.status} - ${entry.description}`);
    }
  }

  console.log('');

  // Check unsynced financial records
  const unsyncedTransactions = await prisma.transaction.count({
    where: { associationId, accountingSynced: false },
  });

  const unsyncedPayments = await prisma.payment.count({
    where: { associationId, accountingSynced: false },
  });

  console.log(`Unsynced Records:`);
  console.log(`  Transactions: ${unsyncedTransactions}`);
  console.log(`  Payments: ${unsyncedPayments}`);

  console.log('');

  // Check if accounting periods exist
  const periodCount = await prisma.accountingPeriod.count({
    where: { associationId },
  });

  console.log(`Accounting Periods: ${periodCount}`);

  console.log('');
  console.log('='.repeat(60));

  // Recommendation
  if (accountCount === 0) {
    console.log('\n⚠️  RECOMMENDATION:');
    console.log('   Accounting is NOT initialized for this association.');
    console.log('   Initialize it by calling:');
    console.log(`   POST /api/accounting/chart-of-accounts/initialize`);
    console.log('   Or use the UI: Settings > Accounting > Initialize Chart of Accounts');
  } else {
    console.log('\n✅ Accounting is properly initialized!');
    if (unsyncedTransactions > 0 || unsyncedPayments > 0) {
      console.log(`   You can now run migration to sync ${unsyncedTransactions + unsyncedPayments} records.`);
    }
  }

  console.log('');

  await prisma.$disconnect();
}

main().catch(console.error);
