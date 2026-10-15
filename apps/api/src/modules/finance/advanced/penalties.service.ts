import { prisma } from '../../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';

// ============================================
// PENALTY SERVICE (TASK-ADV-005, TASK-ADV-006, TASK-ADV-007)
// ============================================

export const penaltiesService = {
  /**
   * Create penalty rule (TASK-ADV-005)
   */
  async createRule(
    associationId: number,
    userId: number,
    data: {
      categoryId?: number;
      name: string;
      description?: string;
      triggerType: 'late_payment' | 'missed_meeting' | 'custom';
      gracePeriodDays: number;
      feeType: 'fixed' | 'percentage';
      feeAmount: number;
      maxFeeAmount?: number;
      isCompounding?: boolean;
      compoundingDays?: number;
    }
  ) {
    // Verify category if provided
    if (data.categoryId) {
      const category = await prisma.financialCategory.findFirst({
        where: { id: data.categoryId, associationId },
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Validate percentage-based rules
    if (data.feeType === 'percentage') {
      if (data.feeAmount <= 0 || data.feeAmount > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }
    }

    const rule = await prisma.penaltyRule.create({
      data: {
        associationId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        gracePeriodDays: data.gracePeriodDays,
        feeType: data.feeType,
        feeAmount: data.feeAmount,
        maxFeeAmount: data.maxFeeAmount,
        isCompounding: data.isCompounding || false,
        compoundingDays: data.compoundingDays,
        isActive: true,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'CREATE',
        tableName: 'penalty_rules',
        recordId: rule.id,
        newValues: rule,
      },
    });

    return rule;
  },

  /**
   * List all penalty rules
   */
  async listRules(
    associationId: number,
    options: {
      isActive?: boolean;
      triggerType?: string;
      categoryId?: number;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { associationId };
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.triggerType) where.triggerType = options.triggerType;
    if (options.categoryId) where.categoryId = options.categoryId;

    const [rules, totalCount] = await Promise.all([
      prisma.penaltyRule.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, type: true } },
          _count: { select: { appliedPenalties: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.penaltyRule.count({ where }),
    ]);

    return {
      rules,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + rules.length < totalCount,
      },
    };
  },

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: number, associationId: number) {
    const rule = await prisma.penaltyRule.findFirst({
      where: { id: ruleId, associationId },
      include: {
        category: { select: { id: true, name: true, type: true } },
        appliedPenalties: {
          include: {
            sourceTransaction: {
              include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              },
            },
            penaltyTransaction: {
              include: {
                payments: { select: { amountPaid: true } },
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!rule) {
      throw new Error('Rule not found');
    }

    // Calculate stats
    let totalApplied = new Decimal(0);
    let totalCollected = new Decimal(0);

    rule.appliedPenalties.forEach(ap => {
      totalApplied = totalApplied.plus(ap.amount);
      if (ap.penaltyTransaction) {
        const paid = ap.penaltyTransaction.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        totalCollected = totalCollected.plus(paid);
      }
    });

    return {
      ...rule,
      stats: {
        totalApplications: rule.appliedPenalties.length,
        totalApplied: totalApplied.toNumber(),
        totalCollected: totalCollected.toNumber(),
        totalOutstanding: totalApplied.minus(totalCollected).toNumber(),
      },
    };
  },

  /**
   * Update penalty rule
   */
  async updateRule(
    ruleId: number,
    associationId: number,
    userId: number,
    data: {
      name?: string;
      description?: string;
      gracePeriodDays?: number;
      feeType?: 'fixed' | 'percentage';
      feeAmount?: number;
      maxFeeAmount?: number;
      isCompounding?: boolean;
      compoundingDays?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.penaltyRule.findFirst({
      where: { id: ruleId, associationId },
    });

    if (!existing) {
      throw new Error('Rule not found');
    }

    const updated = await prisma.penaltyRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        description: data.description,
        gracePeriodDays: data.gracePeriodDays,
        feeType: data.feeType,
        feeAmount: data.feeAmount,
        maxFeeAmount: data.maxFeeAmount,
        isCompounding: data.isCompounding,
        compoundingDays: data.compoundingDays,
        isActive: data.isActive,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'UPDATE',
        tableName: 'penalty_rules',
        recordId: ruleId,
        oldValues: existing,
        newValues: updated,
      },
    });

    return updated;
  },

  /**
   * Delete penalty rule
   */
  async deleteRule(ruleId: number, associationId: number, userId: number) {
    const rule = await prisma.penaltyRule.findFirst({
      where: { id: ruleId, associationId },
      include: { _count: { select: { appliedPenalties: true } } },
    });

    if (!rule) {
      throw new Error('Rule not found');
    }

    if (rule._count.appliedPenalties > 0) {
      // Soft delete by deactivating
      await prisma.penaltyRule.update({
        where: { id: ruleId },
        data: { isActive: false },
      });
    } else {
      await prisma.penaltyRule.delete({ where: { id: ruleId } });
    }

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'DELETE',
        tableName: 'penalty_rules',
        recordId: ruleId,
        oldValues: rule,
      },
    });

    return { success: true };
  },

  /**
   * Calculate late fee for a transaction (TASK-ADV-006)
   */
  calculateLateFee(
    transactionAmount: Decimal,
    rule: {
      feeType: string;
      feeAmount: Decimal;
      maxFeeAmount: Decimal | null;
    }
  ): Decimal {
    let fee: Decimal;

    if (rule.feeType === 'percentage') {
      fee = transactionAmount.times(rule.feeAmount).dividedBy(100);
    } else {
      fee = rule.feeAmount;
    }

    // Apply max cap if set
    if (rule.maxFeeAmount && fee.greaterThan(rule.maxFeeAmount)) {
      fee = rule.maxFeeAmount;
    }

    return fee;
  },

  /**
   * Apply late fees to overdue transactions (TASK-ADV-006)
   * This is called by the cron job
   */
  async applyLateFees(associationId: number, userId: number) {
    const now = new Date();

    // Get active late payment rules
    const rules = await prisma.penaltyRule.findMany({
      where: {
        associationId,
        isActive: true,
        triggerType: 'late_payment',
      },
    });

    if (rules.length === 0) {
      return { applied: 0, totalAmount: 0 };
    }

    // Get overdue transactions that haven't had penalties applied yet
    const overdueTransactions = await prisma.transaction.findMany({
      where: {
        associationId,
        status: { in: ['pending', 'overdue', 'partial'] },
        dueDate: { lt: now },
      },
      include: {
        category: true,
        payments: { select: { amountPaid: true } },
        sourcePenalties: true,
      },
    });

    const results: { transactionId: number; penaltyAmount: number; ruleId: number }[] = [];
    const txnCount = await prisma.transaction.count({ where: { associationId } });
    let penaltyIndex = 0;

    for (const txn of overdueTransactions) {
      // Find applicable rule (category-specific or general)
      const applicableRule = rules.find(r => r.categoryId === txn.categoryId) ||
        rules.find(r => r.categoryId === null);

      if (!applicableRule) continue;

      // Check grace period
      const dueDate = new Date(txn.dueDate!);
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPastDue <= applicableRule.gracePeriodDays) continue;

      // Check if penalty already applied for this rule
      const existingPenalty = txn.sourcePenalties.find(p => p.ruleId === applicableRule.id);
      
      if (existingPenalty && !applicableRule.isCompounding) continue;

      // For compounding, check if enough days have passed since last penalty
      if (existingPenalty && applicableRule.isCompounding) {
        const lastPenaltyDate = new Date(existingPenalty.appliedAt);
        const daysSinceLastPenalty = Math.floor(
          (now.getTime() - lastPenaltyDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastPenalty < (applicableRule.compoundingDays || 30)) continue;
      }

      // Calculate outstanding amount
      const paidAmount = txn.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const outstandingAmount = new Decimal(txn.amount).minus(paidAmount);

      if (outstandingAmount.lessThanOrEqualTo(0)) continue;

      // Calculate penalty
      const penaltyAmount = this.calculateLateFee(outstandingAmount, applicableRule);

      // Get or create penalty category
      let penaltyCategory = await prisma.financialCategory.findFirst({
        where: { associationId, type: 'penalty', name: 'Late Payment Fee' },
      });

      if (!penaltyCategory) {
        penaltyCategory = await prisma.financialCategory.create({
          data: {
            associationId,
            name: 'Late Payment Fee',
            type: 'penalty',
            description: 'Automatically applied late payment penalty',
            isActive: true,
          },
        });
      }

      // Create penalty transaction and record
      const penaltyTxn = await prisma.transaction.create({
        data: {
          associationId,
          memberId: txn.memberId,
          categoryId: penaltyCategory.id,
          amount: penaltyAmount,
          referenceNumber: `TXN${String(txnCount + penaltyIndex + 1).padStart(6, '0')}`,
          status: 'pending',
          notes: `Late fee for ${txn.referenceNumber} - ${applicableRule.name}`,
          createdBy: userId,
        },
      });

      await prisma.appliedPenalty.create({
        data: {
          ruleId: applicableRule.id,
          sourceTransactionId: txn.id,
          penaltyTransactionId: penaltyTxn.id,
          amount: penaltyAmount,
        },
      });

      // Update original transaction status to overdue if not already
      if (txn.status !== 'overdue') {
        await prisma.transaction.update({
          where: { id: txn.id },
          data: { status: 'overdue' },
        });
      }

      // G45: auto-applied penalties create a Transaction directly, bypassing
      // finance.controller.ts's sync hook — wire it here so penalties sync
      // the same way manually-created transactions already do.
      try {
        const fullPenaltyTxn = await prisma.transaction.findUnique({
          where: { id: penaltyTxn.id },
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        });
        if (fullPenaltyTxn) {
          await accountingIntegrationService.onTransactionCreated(fullPenaltyTxn, userId);
        }
      } catch (syncError) {
        console.error(`Accounting sync failed for penalty transaction ${penaltyTxn.id} (non-critical):`, syncError);
      }

      results.push({
        transactionId: txn.id,
        penaltyAmount: penaltyAmount.toNumber(),
        ruleId: applicableRule.id,
      });

      penaltyIndex++;
    }

    if (results.length > 0) {
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'APPLY_LATE_FEES',
          tableName: 'applied_penalties',
          newValues: {
            count: results.length,
            totalAmount: results.reduce((sum, r) => sum + r.penaltyAmount, 0),
            details: results,
          },
        },
      });
    }

    return {
      applied: results.length,
      totalAmount: results.reduce((sum, r) => sum + r.penaltyAmount, 0),
      details: results,
    };
  },

  /**
   * Waive a penalty (TASK-ADV-007)
   */
  async waivePenalty(
    transactionId: number,
    associationId: number,
    userId: number,
    data: {
      waivedAmount: number;
      reason: string;
    }
  ) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, associationId },
      include: {
        category: true,
        payments: { select: { amountPaid: true } },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.category.type !== 'penalty') {
      throw new Error('Can only waive penalty transactions');
    }

    const paidAmount = transaction.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid),
      new Decimal(0)
    );
    const outstandingAmount = new Decimal(transaction.amount).minus(paidAmount);

    if (new Decimal(data.waivedAmount).greaterThan(outstandingAmount)) {
      throw new Error(`Waived amount cannot exceed outstanding balance of ${outstandingAmount}`);
    }

    // Create waiver record
    const waiver = await prisma.penaltyWaiver.create({
      data: {
        associationId,
        transactionId,
        waivedAmount: data.waivedAmount,
        reason: data.reason,
        waivedBy: userId,
      },
    });

    // Update transaction status if fully waived
    const newOutstanding = outstandingAmount.minus(data.waivedAmount);
    if (newOutstanding.lessThanOrEqualTo(0)) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'waived' },
      });
    }

    await prisma.auditLog.create({
      data: {
        associationId,
        userId,
        action: 'WAIVE_PENALTY',
        tableName: 'penalty_waivers',
        recordId: waiver.id,
        newValues: {
          transactionId,
          waivedAmount: data.waivedAmount,
          reason: data.reason,
        },
      },
    });

    return waiver;
  },

  /**
   * Get penalty waivers for a transaction
   */
  async getWaivers(transactionId: number, associationId: number) {
    const waivers = await prisma.penaltyWaiver.findMany({
      where: { transactionId, associationId },
      orderBy: { waivedAt: 'desc' },
    });

    return waivers;
  },

  /**
   * List all waivers for an association
   */
  async listWaivers(
    associationId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (options.startDate || options.endDate) {
      where.waivedAt = {};
      if (options.startDate) where.waivedAt.gte = options.startDate;
      if (options.endDate) where.waivedAt.lte = options.endDate;
    }

    const [waivers, totalCount] = await Promise.all([
      prisma.penaltyWaiver.findMany({
        where,
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { waivedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.penaltyWaiver.count({ where }),
    ]);

    return {
      waivers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + waivers.length < totalCount,
      },
    };
  },

  /**
   * Get penalty statistics
   */
  async getPenaltyStats(associationId: number) {
    const [
      totalRules,
      activeRules,
      totalApplied,
      totalWaivers,
    ] = await Promise.all([
      prisma.penaltyRule.count({ where: { associationId } }),
      prisma.penaltyRule.count({ where: { associationId, isActive: true } }),
      prisma.appliedPenalty.findMany({
        where: { rule: { associationId } },
        include: {
          penaltyTransaction: {
            include: { payments: { select: { amountPaid: true } } },
          },
        },
      }),
      prisma.penaltyWaiver.aggregate({
        where: { associationId },
        _sum: { waivedAmount: true },
        _count: true,
      }),
    ]);

    let totalPenaltyAmount = new Decimal(0);
    let totalCollected = new Decimal(0);

    totalApplied.forEach(ap => {
      totalPenaltyAmount = totalPenaltyAmount.plus(ap.amount);
      if (ap.penaltyTransaction) {
        const paid = ap.penaltyTransaction.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        );
        totalCollected = totalCollected.plus(paid);
      }
    });

    return {
      rules: {
        total: totalRules,
        active: activeRules,
      },
      penalties: {
        totalApplied: totalApplied.length,
        totalAmount: totalPenaltyAmount.toNumber(),
        totalCollected: totalCollected.toNumber(),
        totalOutstanding: totalPenaltyAmount.minus(totalCollected).toNumber(),
      },
      waivers: {
        count: totalWaivers._count,
        totalWaived: totalWaivers._sum.waivedAmount?.toNumber() || 0,
      },
    };
  },
};
