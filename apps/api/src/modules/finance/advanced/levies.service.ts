import { prisma } from '../../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';
import { syncLedgerDebit } from '../ledger-sync';
import { cacheInvalidationService } from '../../../services/cache-invalidation.service';
import { memberLedgerService } from '../../member-finance/member-ledger.service';
import {
  LevyRuleError,
  assertAssignmentRemovable,
  assertCanAssign,
  assertDeadlineNotPast,
  assertStatusChange,
  effectiveStatus,
  type CampaignStatus,
} from './levy-rules';

// ============================================
// LEVY CAMPAIGN SERVICE (TASK-ADV-001, TASK-ADV-002)
// ============================================

export const leviesService = {
  /**
   * Create a new levy campaign
   */
  async createCampaign(
    associationId: number,
    userId: number,
    data: {
      categoryId: number;
      name: string;
      description?: string;
      targetAmount: number;
      amountPerMember?: number;
      deadline: Date;
    }
  ) {
    assertDeadlineNotPast(data.deadline);

    // Verify category exists and is a levy type
    const category = await prisma.financialCategory.findFirst({
      where: { id: data.categoryId, associationId, type: 'levy', isActive: true },
    });

    if (!category) {
      throw new Error('Levy category not found or inactive');
    }

    const campaign = await prisma.levyCampaign.create({
      data: {
        associationId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        targetAmount: data.targetAmount,
        amountPerMember: data.amountPerMember,
        deadline: data.deadline,
        status: 'ACTIVE',
        createdBy: userId,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'CREATE',
        tableName: 'levy_campaigns',
        recordId: campaign.id,
        newValues: campaign,
      },
    });

    return campaign;
  },

  /**
   * Get all levy campaigns for an association
   */
  async listCampaigns(
    associationId: number,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { associationId };
    if (options.status) {
      where.status = options.status;
    }

    const [campaigns, totalCount] = await Promise.all([
      prisma.levyCampaign.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          assignments: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              transaction: {
                include: {
                  payments: { select: { amountPaid: true } },
                },
              },
            },
          },
          _count: { select: { assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.levyCampaign.count({ where }),
    ]);

    // Calculate progress for each campaign
    const campaignsWithProgress = campaigns.map(campaign => {
      let totalAssigned = new Decimal(0);
      let totalCollected = new Decimal(0);
      let paidMembers = 0;

      campaign.assignments.forEach(assignment => {
        totalAssigned = totalAssigned.plus(assignment.amount);
        let paid = new Decimal(0);
        if (assignment.transaction) {
          paid = assignment.transaction.payments.reduce(
            (sum, p) => sum.plus(p.amountPaid),
            new Decimal(0)
          );
          totalCollected = totalCollected.plus(paid);
        }
        if (new Decimal(assignment.amount).minus(paid).lessThanOrEqualTo(0)) paidMembers++;
      });

      const progressPercentage = campaign.targetAmount.greaterThan(0)
        ? totalCollected.dividedBy(campaign.targetAmount).times(100).toNumber()
        : 0;

      return {
        ...campaign,
        storedStatus: campaign.status,
        status: effectiveStatus(campaign.status as CampaignStatus, campaign._count.assignments, paidMembers),
        progress: {
          totalAssigned: totalAssigned.toNumber(),
          totalCollected: totalCollected.toNumber(),
          remaining: new Decimal(campaign.targetAmount).minus(totalCollected).toNumber(),
          progressPercentage: Math.min(progressPercentage, 100),
          assignedMembers: campaign._count.assignments,
          paidCount: paidMembers,
          stillOwed: totalAssigned.minus(totalCollected).toNumber(),
        },
      };
    });

    return {
      campaigns: campaignsWithProgress,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + campaigns.length < totalCount,
      },
    };
  },

  /**
   * Get campaign by ID with full details
   */
  async getCampaignById(campaignId: number, associationId: number) {
    const campaign = await prisma.levyCampaign.findFirst({
      where: { id: campaignId, associationId },
      include: {
        category: { select: { id: true, name: true, type: true } },
        assignments: {
          include: {
            member: {
              select: { id: true, memberId: true, firstName: true, lastName: true, email: true },
            },
            transaction: {
              include: {
                payments: {
                  select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true },
                  orderBy: { paymentDate: 'desc' },
                },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Calculate detailed progress
    let totalAssigned = new Decimal(0);
    let totalCollected = new Decimal(0);
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;

    const assignmentsWithBalance = campaign.assignments.map(assignment => {
      totalAssigned = totalAssigned.plus(assignment.amount);
      
      let paidAmount = new Decimal(0);
      if (assignment.transaction) {
        paidAmount = assignment.transaction.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        totalCollected = totalCollected.plus(paidAmount);
      }

      const balance = new Decimal(assignment.amount).minus(paidAmount);
      const status = balance.lessThanOrEqualTo(0) ? 'paid' : paidAmount.greaterThan(0) ? 'partial' : 'pending';

      if (status === 'paid') paidCount++;
      else if (status === 'partial') partialCount++;
      else pendingCount++;

      return {
        ...assignment,
        paidAmount: paidAmount.toNumber(),
        balance: balance.toNumber(),
        calculatedStatus: status,
      };
    });

    const progressPercentage = campaign.targetAmount.greaterThan(0)
      ? totalCollected.dividedBy(campaign.targetAmount).times(100).toNumber()
      : 0;

    return {
      ...campaign,
      storedStatus: campaign.status,
      status: effectiveStatus(campaign.status as CampaignStatus, campaign.assignments.length, paidCount),
      assignments: assignmentsWithBalance,
      progress: {
        totalAssigned: totalAssigned.toNumber(),
        totalCollected: totalCollected.toNumber(),
        remaining: new Decimal(campaign.targetAmount).minus(totalCollected).toNumber(),
        stillOwed: totalAssigned.minus(totalCollected).toNumber(),
        progressPercentage: Math.min(progressPercentage, 100),
        assignedMembers: campaign.assignments.length,
        paidCount,
        partialCount,
        pendingCount,
      },
    };
  },

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: number,
    associationId: number,
    userId: number,
    data: {
      name?: string;
      description?: string;
      targetAmount?: number;
      amountPerMember?: number;
      deadline?: Date;
      status?: 'ACTIVE' | 'CLOSED';
    }
  ) {
    const existing = await prisma.levyCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!existing) {
      throw new LevyRuleError('Campaign not found', 404, 'NOT_FOUND');
    }

    if (data.status) assertStatusChange(existing.status as CampaignStatus, data.status);
    if (data.deadline && data.deadline.getTime() !== existing.deadline.getTime()) assertDeadlineNotPast(data.deadline);

    const updated = await prisma.levyCampaign.update({
      where: { id: campaignId },
      data: {
        name: data.name,
        description: data.description,
        targetAmount: data.targetAmount,
        amountPerMember: data.amountPerMember,
        deadline: data.deadline,
        status: data.status,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'UPDATE',
        tableName: 'levy_campaigns',
        recordId: campaignId,
        oldValues: existing,
        newValues: updated,
      },
    });

    return updated;
  },

  /**
   * Assign levy to specific members (TASK-ADV-002)
   */
  async assignToMembers(
    campaignId: number,
    associationId: number,
    userId: number,
    data: {
      memberIds?: number[];
      /** Every active member of the association, instead of a chosen list. */
      allActive?: boolean;
      amount?: number; // Override amount per member
      createTransactions?: boolean;
    }
  ) {
    const campaign = await prisma.levyCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!campaign) {
      throw new LevyRuleError('Campaign not found', 404, 'NOT_FOUND');
    }
    assertCanAssign(campaign.status as CampaignStatus);

    let requested: number[];
    if (data.allActive) {
      const everyone = await prisma.member.findMany({ where: { associationId, status: 'active' }, select: { id: true } });
      requested = everyone.map((m) => m.id);
    } else {
      requested = data.memberIds ?? [];
    }
    if (requested.length === 0) {
      throw new LevyRuleError('Choose at least one member.', 400, 'NO_MEMBERS');
    }

    // Verify all members exist
    const members = await prisma.member.findMany({
      where: { id: { in: requested }, associationId, status: 'active' },
    });

    if (members.length !== requested.length) {
      throw new LevyRuleError('Some members were not found or are not active.', 400, 'MEMBERS_NOT_FOUND');
    }

    // Check for existing assignments
    const existingAssignments = await prisma.levyCampaignAssignment.findMany({
      where: { campaignId, memberId: { in: requested } },
    });

    const existingMemberIds = new Set(existingAssignments.map(a => a.memberId));
    const newMemberIds = requested.filter(id => !existingMemberIds.has(id));

    if (newMemberIds.length === 0) {
      throw new LevyRuleError('All selected members are already assigned to this campaign.', 409, 'ALREADY_ASSIGNED');
    }

    const amountPerMember = data.amount || campaign.amountPerMember?.toNumber() || 0;
    if (amountPerMember <= 0) {
      throw new LevyRuleError('Amount per member must be specified.', 400, 'AMOUNT_REQUIRED');
    }

    // Get transaction count for reference numbers
    const txnCount = await prisma.transaction.count({ where: { associationId } });

    // Create assignments without using interactive transaction to avoid timeout
    const assignments = [];
    
    for (let i = 0; i < newMemberIds.length; i++) {
      const memberId = newMemberIds[i];
      let transactionId: number | undefined;

      if (data.createTransactions !== false) {
        // Create transaction for this assignment
        const transaction = await prisma.transaction.create({
          data: {
            associationId,
            memberId,
            categoryId: campaign.categoryId,
            amount: amountPerMember,
            dueDate: campaign.deadline,
            referenceNumber: `TXN${String(txnCount + i + 1).padStart(6, '0')}`,
            status: 'pending',
            notes: `Levy Campaign: ${campaign.name}`,
            createdBy: userId,
          },
        });
        transactionId = transaction.id;

        // The member now owes this levy — put it on their ledger so a later payment offsets it instead of standing alone as a credit.
        await syncLedgerDebit(transaction.id, userId);

        // G45: levy campaign assignment creates a Transaction directly,
        // bypassing finance.controller.ts's sync hook — wire it here too.
        try {
          const fullLevyTxn = await prisma.transaction.findUnique({
            where: { id: transaction.id },
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          });
          if (fullLevyTxn) {
            await accountingIntegrationService.onTransactionCreated(fullLevyTxn, userId);
          }
        } catch (syncError) {
          console.error(`Accounting sync failed for levy transaction ${transaction.id} (non-critical):`, syncError);
        }
      }

      const assignment = await prisma.levyCampaignAssignment.create({
        data: {
          campaignId,
          memberId,
          transactionId,
          amount: amountPerMember,
          status: 'pending',
        },
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        },
      });

      assignments.push(assignment);
    }

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'ASSIGN_LEVY',
        tableName: 'levy_campaign_assignments',
        newValues: {
          campaignId,
          memberCount: assignments.length,
          amountPerMember,
        },
      },
    });

    await cacheInvalidationService.onTransactionChange(associationId);

    return {
      assigned: assignments.length,
      skipped: existingAssignments.length,
      assignments,
    };
  },

  /**
   * Remove member from campaign
   */
  async removeAssignment(
    assignmentId: number,
    associationId: number,
    userId: number
  ) {
    const assignment = await prisma.levyCampaignAssignment.findFirst({
      where: { id: assignmentId },
      include: {
        campaign: { select: { associationId: true, name: true } },
        transaction: { include: { payments: true } },
      },
    });

    if (!assignment || assignment.campaign.associationId !== associationId) {
      throw new LevyRuleError('Assignment not found', 404, 'NOT_FOUND');
    }

    assertAssignmentRemovable(assignment.transaction?.payments.length ?? 0);

    // The charge is voided, not deleted, so the member's ledger and every total can drop it cleanly and the record of what was
    // raised stays. The assignment row goes, so the member can be assigned again if it was a slip.
    await prisma.$transaction(async (tx) => {
      if (assignment.transactionId) {
        await tx.transaction.update({
          where: { id: assignment.transactionId },
          data: {
            isVoided: true,
            voidReason: `Removed from levy campaign "${assignment.campaign.name}"`,
            voidedAt: new Date(),
            voidedBy: userId,
          },
        });
      }
      await tx.levyCampaignAssignment.delete({ where: { id: assignmentId } });
    });

    if (assignment.transactionId) {
      await memberLedgerService.syncExistingTransactions(associationId, assignment.memberId, userId, true);
    }
    await cacheInvalidationService.onTransactionChange(associationId);

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'REMOVE_ASSIGNMENT',
        tableName: 'levy_campaign_assignments',
        recordId: assignmentId,
        oldValues: assignment,
      },
    });

    return { success: true };
  },

  /**
   * Get campaign progress summary
   */
  async getCampaignProgress(campaignId: number, associationId: number) {
    const campaign = await this.getCampaignById(campaignId, associationId);
    
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        targetAmount: campaign.targetAmount,
        amountPerMember: campaign.amountPerMember,
        deadline: campaign.deadline,
        status: campaign.status,
        category: campaign.category,
        assignments: campaign.assignments.map(a => ({
          id: a.id,
          memberId: a.memberId,
          amount: a.amount,
          status: a.calculatedStatus || a.status,
          assignedAt: a.assignedAt,
          member: a.member,
          transaction: a.transaction,
        })),
        createdAt: campaign.createdAt,
      },
      totalAssigned: campaign.progress.totalAssigned,
      totalCollected: campaign.progress.totalCollected,
      stillOwed: campaign.progress.stillOwed,
      totalMembers: campaign.progress.assignedMembers,
      paidMembers: campaign.progress.paidCount,
      progressPercentage: campaign.progress.progressPercentage,
      daysRemaining: Math.max(
        0,
        Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      ),
    };
  },
};
