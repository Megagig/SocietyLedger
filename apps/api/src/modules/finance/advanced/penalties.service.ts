import { prisma } from '../../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';
import { syncLedgerDebit } from '../ledger-sync';
import { SettingsService } from '../../settings/settings.service';
import { cacheInvalidationService } from '../../../services/cache-invalidation.service';
import { memberLedgerService } from '../../member-finance/member-ledger.service';
import { RuleError } from '../rule-error';
import { assertFeeValid, assertWaivable, daysPastDue, lateFeeDue, pickRule, waiverOutcome } from './penalty-rules';

/** One charge that is due a late fee right now, with the fee worked out. */
type LateFeePlanItem = {
  txn: {
    id: number;
    memberId: number;
    status: string;
    referenceNumber: string | null;
    category: { name: string };
    member: { id: number; firstName: string; lastName: string };
  };
  rule: { id: number; name: string };
  penaltyAmount: Decimal;
  daysOverdue: number;
};

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
        throw new RuleError('Category not found', 404, 'NOT_FOUND');
      }
    }

    assertFeeValid(data.feeType, data.feeAmount);

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
      throw new RuleError('Rule not found', 404, 'NOT_FOUND');
    }
    assertFeeValid(data.feeType ?? existing.feeType, data.feeAmount ?? Number(existing.feeAmount));

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
   * The active late-payment rules. With none written, a general rule is derived from Financial Settings (R4.6/G53: enableLateFees,
   * lateFeeType, lateFeeAmount and defaultGracePeriodDays were saved but never read by anything). `persistFallback` saves that rule
   * for a real run; a preview only describes it, so looking never changes anything.
   */
  async loadLateFeeRules(associationId: number, userId: number, persistFallback: boolean) {
    const rules = await prisma.penaltyRule.findMany({
      where: { associationId, isActive: true, triggerType: 'late_payment' },
    });
    if (rules.length > 0) return rules;

    const financialSettings = await SettingsService.getSettings(associationId, 'financial');
    if (!financialSettings.enableLateFees) return rules;

    const spec = {
      name: 'Default Late Fee (from Financial Settings)',
      triggerType: 'late_payment' as const,
      gracePeriodDays: financialSettings.defaultGracePeriodDays ?? 7,
      feeType: (financialSettings.lateFeeType ?? 'fixed') as 'fixed' | 'percentage',
      feeAmount: financialSettings.lateFeeAmount ?? 0,
    };
    if (persistFallback) return [await this.createRule(associationId, userId, spec)];
    return [
      {
        id: 0, associationId, categoryId: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
        ...spec, feeAmount: new Decimal(spec.feeAmount), maxFeeAmount: null, isCompounding: false, compoundingDays: null,
      },
    ] as typeof rules;
  },

  /**
   * Works out which overdue charges are due a late fee right now, and how much, without changing anything. A voided charge, a donation
   * pledge or any charge that isn't a due or a levy (unless a rule names its category) never earns one.
   */
  async planLateFees(associationId: number, userId: number, persistFallback: boolean) {
    const now = new Date();
    const rules = await this.loadLateFeeRules(associationId, userId, persistFallback);
    if (rules.length === 0) return { now, plan: [] as LateFeePlanItem[] };

    const overdue = await prisma.transaction.findMany({
      where: {
        associationId,
        isVoided: false,
        status: { in: ['pending', 'overdue', 'partial'] },
        dueDate: { lt: now },
      },
      include: {
        category: true,
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        payments: { select: { amountPaid: true } },
        sourcePenalties: true,
      },
    });

    const plan: LateFeePlanItem[] = [];
    for (const txn of overdue) {
      const rule = pickRule(rules, { categoryId: txn.categoryId, categoryType: txn.category.type });
      if (!rule) continue;

      const lastApplied = txn.sourcePenalties
        .filter((p) => p.ruleId === rule.id)
        .reduce<Date | null>((latest, p) => (latest === null || p.appliedAt > latest ? p.appliedAt : latest), null);
      const due = lateFeeDue(
        { isVoided: txn.isVoided, status: txn.status, dueDate: txn.dueDate, categoryId: txn.categoryId, categoryType: txn.category.type },
        rule,
        lastApplied,
        now,
      );
      if (!due) continue;

      const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      const outstanding = new Decimal(txn.amount).minus(paid);
      if (outstanding.lessThanOrEqualTo(0)) continue;

      const penaltyAmount = this.calculateLateFee(outstanding, rule);
      if (penaltyAmount.lessThanOrEqualTo(0)) continue;

      plan.push({ txn, rule, penaltyAmount, daysOverdue: daysPastDue(txn.dueDate!, now) });
    }
    return { now, plan };
  },

  /**
   * What "Apply late fees now" would do, without doing it: how many charges, the total, and who. The officer confirms on this before
   * anyone is charged.
   */
  async previewLateFees(associationId: number, userId: number) {
    const { plan } = await this.planLateFees(associationId, userId, false);
    const total = plan.reduce((sum, p) => sum.plus(p.penaltyAmount), new Decimal(0));
    const members = new Set(plan.map((p) => p.txn.memberId));
    return {
      count: plan.length,
      memberCount: members.size,
      totalAmount: total.toNumber(),
      items: plan.slice(0, 100).map((p) => ({
        transactionId: p.txn.id,
        memberId: p.txn.member.id,
        memberName: `${p.txn.member.firstName} ${p.txn.member.lastName}`.trim(),
        chargeName: p.txn.category.name,
        daysOverdue: p.daysOverdue,
        ruleName: p.rule.name,
        penaltyAmount: p.penaltyAmount.toNumber(),
      })),
      truncated: plan.length > 100,
    };
  },

  /**
   * Apply late fees to overdue transactions (TASK-ADV-006)
   * This is called by the cron job, and by an officer after previewing.
   */
  async applyLateFees(associationId: number, userId: number) {
    const { plan } = await this.planLateFees(associationId, userId, true);
    if (plan.length === 0) return { applied: 0, totalAmount: 0 };

    const results: { transactionId: number; penaltyAmount: number; ruleId: number }[] = [];
    const txnCount = await prisma.transaction.count({ where: { associationId } });

    // The category the fees are charged under, made once.
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

    let penaltyIndex = 0;
    for (const { txn, rule, penaltyAmount } of plan) {
      // Create penalty transaction and record
      const penaltyTxn = await prisma.transaction.create({
        data: {
          associationId,
          memberId: txn.memberId,
          categoryId: penaltyCategory.id,
          amount: penaltyAmount,
          referenceNumber: `TXN${String(txnCount + penaltyIndex + 1).padStart(6, '0')}`,
          status: 'pending',
          // G71: referenceNumber is genuinely nullable — fall back to the category + id
          // instead of letting it render as a literal "null" in the note text
          notes: `Late fee for ${txn.referenceNumber || `${txn.category.name} #${txn.id}`} - ${rule.name}`,
          createdBy: userId,
        },
      });

      await prisma.appliedPenalty.create({
        data: {
          ruleId: rule.id,
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

      // The member now owes the penalty — put it on their ledger (otherwise paying it later shows as a lone credit).
      await syncLedgerDebit(penaltyTxn.id, userId);

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
        ruleId: rule.id,
      });

      penaltyIndex++;
    }

    await cacheInvalidationService.onTransactionChange(associationId);

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

    return {
      applied: results.length,
      totalAmount: results.reduce((sum, r) => sum + r.penaltyAmount, 0),
      details: results,
    };
  },

  /**
   * Waive a penalty (TASK-ADV-007): forgive some or all of what is still owed on it.
   *
   * The penalty charge's amount goes down by what is waived (so balances, overdue lists and reminders are right everywhere), a full
   * waiver marks it Waived, the member's ledger is credited, and the waiver is kept as history with its reason. Claim-then-act: the
   * charge is only changed if it is still exactly as it was read, so two officers can't both waive the same penalty.
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
      throw new RuleError('Penalty not found', 404, 'NOT_FOUND');
    }

    const paidAmount = transaction.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid),
      new Decimal(0)
    );
    const amount = new Decimal(transaction.amount);
    const outstandingAmount = amount.minus(paidAmount);

    assertWaivable(
      { categoryType: transaction.category.type, isVoided: transaction.isVoided, status: transaction.status },
      outstandingAmount,
      data.waivedAmount,
    );
    const { newAmount, fullyWaived } = waiverOutcome(amount, paidAmount, data.waivedAmount);

    const waiver = await prisma.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: { id: transactionId, associationId, isVoided: false, status: { not: 'waived' }, amount: transaction.amount },
        data: { amount: newAmount, ...(fullyWaived ? { status: 'waived' } : {}) },
      });
      if (claimed.count === 0) {
        throw new RuleError('This penalty was just changed. Reload it and try again.', 409, 'CONFLICT');
      }
      return tx.penaltyWaiver.create({
        data: {
          associationId,
          transactionId,
          waivedAmount: data.waivedAmount,
          reason: data.reason,
          waivedBy: userId,
        },
      });
    });

    // The member's ledger gets a credit for what was forgiven (a ledger problem never undoes the waiver; the ledger can be rebuilt).
    try {
      await memberLedgerService.createFromWaiver(waiver.id, userId);
    } catch (ledgerError) {
      console.error(`Ledger sync failed for waiver ${waiver.id} (non-critical):`, ledgerError);
    }
    await cacheInvalidationService.onTransactionChange(associationId);

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
          previousAmount: amount.toNumber(),
          newAmount: newAmount.toNumber(),
          fullyWaived,
        },
      },
    });

    return { ...waiver, newAmount: newAmount.toNumber(), fullyWaived };
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
