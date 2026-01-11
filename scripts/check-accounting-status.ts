/**
 * CHECK ACCOUNTING STATUS
 * 
 * Quick diagnostic script to check which associations have accounting initialized
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('ACCOUNTING INITIALIZATION STATUS');
  console.log('='.repeat(60) + '\n');

  const associations = await prisma.association.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${associations.length} active associations\n`);

  for (const association of associations) {
    const accountCount = await prisma.chartOfAccount.count({
      where: { associationId: association.id },
    });

    const status = accountCount > 0 ? '✅ INITIALIZED' : '❌ NOT INITIALIZED';
    console.log(`Association ${association.id}: ${association.name}`);
    console.log(`  Status: ${status}`);
    console.log(`  Accounts: ${accountCount}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main();
