/**
 * Platform Association Seed Script
 * 
 * Phase 22: Hybrid Super Admin Architecture
 * 
 * This script creates the "Platform" association that Super Admins belong to.
 * It also migrates existing Super Admins (with associationId = NULL) to this association.
 * 
 * IMPORTANT: This script is idempotent - safe to run multiple times.
 */

import { PrismaClient, AssociationTier, AssociationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Setting up Platform Association for Hybrid Super Admin Architecture...\n');

  // Step 1: Create or update the Platform Association
  console.log('📝 Creating/updating Platform Association...');
  
  const platformAssociation = await prisma.association.upsert({
    where: { subdomain: 'platform' },
    update: {
      isPlatformAssociation: true,
      status: AssociationStatus.ACTIVE,
    },
    create: {
      name: 'SocietyLedger Platform',
      subdomain: 'platform',
      slug: 'platform',
      tier: AssociationTier.ENTERPRISE,
      status: AssociationStatus.ACTIVE,
      isPlatformAssociation: true,
      primaryColor: '#1a56db', // Platform blue
    },
  });

  console.log(`✅ Platform Association ready: ID=${platformAssociation.id}, subdomain=${platformAssociation.subdomain}`);
  console.log('');

  // Step 2: Find Super Admins with NULL associationId
  console.log('🔍 Finding Super Admins without association...');
  
  const superAdminsWithoutAssociation = await prisma.user.findMany({
    where: {
      platformRole: 'SUPER_ADMIN',
      associationId: null,
    },
    select: {
      id: true,
      email: true,
    },
  });

  console.log(`   Found ${superAdminsWithoutAssociation.length} Super Admin(s) without association`);

  // Step 3: Migrate Super Admins to Platform Association
  if (superAdminsWithoutAssociation.length > 0) {
    console.log('');
    console.log('🔄 Migrating Super Admins to Platform Association...');
    
    for (const admin of superAdminsWithoutAssociation) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { associationId: platformAssociation.id },
      });
      console.log(`   ✅ Migrated: ${admin.email} (ID: ${admin.id})`);
    }
    
    console.log('');
    console.log(`✅ Successfully migrated ${superAdminsWithoutAssociation.length} Super Admin(s)`);
  } else {
    console.log('   ℹ️  No Super Admins need migration');
  }

  // Step 4: Verify the migration
  console.log('');
  console.log('🔍 Verification...');
  
  const remainingWithoutAssociation = await prisma.user.count({
    where: {
      platformRole: 'SUPER_ADMIN',
      associationId: null,
    },
  });

  const superAdminsInPlatform = await prisma.user.count({
    where: {
      platformRole: 'SUPER_ADMIN',
      associationId: platformAssociation.id,
    },
  });

  console.log(`   Super Admins in Platform Association: ${superAdminsInPlatform}`);
  console.log(`   Super Admins without association: ${remainingWithoutAssociation}`);

  if (remainingWithoutAssociation > 0) {
    console.log('');
    console.log('⚠️  Warning: Some Super Admins still have no association.');
    console.log('   This may be intentional if they belong to specific associations.');
  }

  console.log('');
  console.log('🎉 Platform Association setup complete!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   Platform Association ID: ${platformAssociation.id}`);
  console.log(`   Platform Subdomain: ${platformAssociation.subdomain}`);
  console.log(`   Super Admins migrated: ${superAdminsWithoutAssociation.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error setting up Platform Association:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
