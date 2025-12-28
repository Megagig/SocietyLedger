import { prisma } from '../../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

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

      campaign.assignments.forEach(assignment => {
        totalAssigned = totalAssigned.plus(assignment.amount);
        if (assignment.transaction) {
          const paid = assignment.transaction.payments.reduce(
            (sum, p) => sum.plus(p.amountPaid),
            new Decimal(0)
          );
          totalCollected = totalCollected.plus(paid);
        }
      });

      const progressPercentage = campaign.targetAmount.greaterThan(0)
        ? totalCollected.dividedBy(campaign.targetAmount).times(100).toNumber()
        : 0;

      return {
        ...campaign,
        progress: {
          totalAssigned: totalAssigned.toNumber(),
          totalCollected: totalCollected.toNumber(),
          remaining: new Decimal(campaign.targetAmount).minus(totalCollected).toNumber(),
          progressPercentage: Math.min(progressPercentage, 100),
          assignedMembers: campaign._count.assignments,
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
      assignments: assignmentsWithBalance,
      progress: {
        totalAssigned: totalAssigned.toNumber(),
        totalCollected: totalCollected.toNumber(),
        remaining: new Decimal(campaign.targetAmount).minus(totalCollected).toNumber(),
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
      status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    }
  ) {
    const existing = await prisma.levyCampaign.findFirst({
      where: { id: campaignId, associationId },
    });

    if (!existing) {
      throw new Error('Campaign not found');
    }

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
      memberIds: number[];
      amount?: number; // Override amount per member
      createTransactions?: boolean;
    }
  ) {
    const campaign = await prisma.levyCampaign.findFirst({
      where: { id: campaignId, associationId, status: 'ACTIVE' },
    });

    if (!campaign) {
      throw new Error('Campaign not found or not active');
    }

    // Verify all members exist
    const members = await prisma.member.findMany({
      where: { id: { in: data.memberIds }, associationId, status: 'active' },
    });

    if (members.length !== data.memberIds.length) {
      throw new Error('Some members not found or inactive');
    }

    // Check for existing assignments
    const existingAssignments = await prisma.levyCampaignAssignment.findMany({
      where: { campaignId, memberId: { in: data.memberIds } },
    });

    const existingMemberIds = new Set(existingAssignments.map(a => a.memberId));
    const newMemberIds = data.memberIds.filter(id => !existingMemberIds.has(id));

    if (newMemberIds.length === 0) {
      throw new Error('All selected members are already assigned to this campaign');
    }

    const amountPerMember = data.amount || campaign.amountPerMember?.toNumber() || 0;
    if (amountPerMember <= 0) {
      throw new Error('Amount per member must be specified');
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
        campaign: { select: { associationId: true } },
        transaction: { include: { payments: true } },
      },
    });

    if (!assignment || assignment.campaign.associationId !== associationId) {
      throw new Error('Assignment not found');
    }

    // Check if there are payments
    if (assignment.transaction && assignment.transaction.payments.length > 0) {
      throw new Error('Cannot remove assignment with recorded payments');
    }

    // Delete transaction if exists
    if (assignment.transactionId) {
      await prisma.transaction.delete({ where: { id: assignment.transactionId } });
    }

    await prisma.levyCampaignAssignment.delete({ where: { id: assignmentId } });

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
