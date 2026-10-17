import { prisma } from '../../lib/prisma';
import { penaltiesService } from '../finance/advanced/penalties.service';
import { SettingsService } from '../settings/settings.service';

// ============================================
// LATE FEES CRON JOB (TASK-ADV-006)
// ============================================

interface AssociationWithAdmin {
  id: number;
  name: string;
  users: { id: number }[];
}

/**
 * Process late fees for all associations
 * This should be run daily via a cron scheduler
 */
export async function processLateFees(): Promise<{
  processed: number;
  totalPenalties: number;
  totalAmount: number;
  errors: string[];
}> {
  console.log('🕐 Starting late fees processing...');
  
  const results = {
    processed: 0,
    totalPenalties: 0,
    totalAmount: 0,
    errors: [] as string[],
  };

  try {
    // Get associations with active late payment penalty rules
    const associations = await prisma.association.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { id: true },
        },
      },
    });

    // Filter to associations with either an active penalty rule, or (R4.6/
    // G53) Financial Settings' enableLateFees on — applyLateFees() falls
    // back to a settings-derived rule in that case, but only gets the
    // chance to if it's actually called.
    const associationsWithRules: AssociationWithAdmin[] = [];
    for (const assoc of associations) {
      const hasRules = await prisma.penaltyRule.count({
        where: {
          associationId: assoc.id,
          isActive: true,
          triggerType: 'late_payment',
        },
      });
      if (hasRules > 0) {
        associationsWithRules.push(assoc);
        continue;
      }

      const enableLateFees = await SettingsService.getSetting(assoc.id, 'financial', 'enableLateFees');
      if (enableLateFees) {
        associationsWithRules.push(assoc);
      }
    }

    console.log(`📋 Found ${associationsWithRules.length} associations with active penalty rules`);

    for (const association of associationsWithRules) {
      try {
        // Use the first admin user for audit logging
        const adminUserId = association.users[0]?.id;
        
        if (!adminUserId) {
          results.errors.push(`Association ${association.id} (${association.name}): No admin user found`);
          continue;
        }

        const result = await penaltiesService.applyLateFees(association.id, adminUserId);
        
        results.processed++;
        results.totalPenalties += result.applied;
        results.totalAmount += result.totalAmount;

        if (result.applied > 0) {
          console.log(`✅ Association ${association.name}: Applied ${result.applied} late fee(s), total: ₦${result.totalAmount.toLocaleString()}`);
        }
      } catch (error: any) {
        results.errors.push(`Association ${association.id} (${association.name}): ${error.message}`);
        console.error(`❌ Error processing association ${association.name}:`, error.message);
      }
    }

    console.log(`🏁 Late fees processing complete:`);
    console.log(`   - Associations processed: ${results.processed}`);
    console.log(`   - Total penalties applied: ${results.totalPenalties}`);
    console.log(`   - Total amount: ₦${results.totalAmount.toLocaleString()}`);
    console.log(`   - Errors: ${results.errors.length}`);

    return results;
  } catch (error: any) {
    console.error('❌ Fatal error in late fees processing:', error);
    results.errors.push(`Fatal error: ${error.message}`);
    return results;
  }
}

/**
 * Update overdue status for all associations
 * This marks pending transactions as overdue if past due date
 */
export async function updateOverdueStatus(): Promise<{
  updated: number;
  errors: string[];
}> {
  console.log('🕐 Starting overdue status update...');
  
  const results = {
    updated: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();

    // Update all pending transactions past due date to overdue
    const result = await prisma.transaction.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      data: {
        status: 'overdue',
      },
    });

    results.updated = result.count;
    console.log(`✅ Updated ${result.count} transaction(s) to overdue status`);

    return results;
  } catch (error: any) {
    console.error('❌ Error updating overdue status:', error);
    results.errors.push(error.message);
    return results;
  }
}
