import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import {
  assertAvailableAfterHold,
  assertCanApprove,
  assertCanReview,
  assertTypeWithdrawable,
  assertWithdrawable,
  assertWithinMonthlyLimit,
  monthWindow,
} from './cooperative-rules';
import { getSavingsPosition } from './savings-lien';
import { applySavingsMovement, syncSavingsToAccounting } from './savings-posting';
import { getTwoStageWithdrawal } from './cooperative-settings';
import { naira, notifyMember, notifyOfficers } from './cooperative-notify';

/**
 * A member asks to take money out of a withdrawable savings account. With two stages on (the default) the request is first REVIEWED by one
 * officer and then APPROVED and paid by a different one; neither can be the member. With two stages off a single officer decides. The
 * balance moves only at final approval, and the checks (balance, savings held against loans, the type's monthly limit) run again then.
 */

const PENDING = ['PENDING_REVIEW', 'PENDING_APPROVAL'] as const;

const include = {
  member: { select: { firstName: true, lastName: true, memberId: true, userId: true } },
  savingsAccount: { select: { accountNumber: true, balance: true, accountTypeRef: { select: { name: true, accountClass: true } } } },
} satisfies Prisma.SavingsWithdrawalRequestInclude;

type Row = Prisma.SavingsWithdrawalRequestGetPayload<{ include: typeof include }>;

export function formatWithdrawal(row: Row) {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: `${row.member.firstName} ${row.member.lastName}`.trim(),
    memberNumber: row.member.memberId,
    savingsAccountId: row.savingsAccountId,
    accountNumber: row.savingsAccount.accountNumber,
    accountTypeName: row.savingsAccount.accountTypeRef?.name ?? 'Savings',
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    twoStage: row.twoStage,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewComment: row.reviewComment,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    approvalComment: row.approvalComment,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    payoutMethod: row.payoutMethod,
    payoutReference: row.payoutReference,
    createdAt: row.createdAt,
  };
}

/** How much the member has already taken from accounts of this type in the month of `now`. */
async function withdrawnThisMonth(db: Prisma.TransactionClient | typeof prisma, memberId: number, typeId: number, now: Date) {
  const { start, end } = monthWindow(now);
  const sum = await db.savingsTransaction.aggregate({
    where: {
      type: 'WITHDRAWAL',
      transactionDate: { gte: start, lt: end },
      savingsAccount: { memberId, accountTypeId: typeId },
    },
    _sum: { amount: true },
  });
  return sum._sum.amount ?? new Decimal(0);
}

/** Everything that decides whether this much may leave this account right now. Run at submission and again at final approval. */
async function assertEligible(
  db: Prisma.TransactionClient | typeof prisma,
  account: {
    id: number;
    associationId: number;
    memberId: number;
    balance: Decimal;
    accountTypeId: number | null;
  },
  amount: Decimal,
  now: Date,
) {
  const type = account.accountTypeId ? await db.cooperativeAccountType.findUnique({ where: { id: account.accountTypeId } }) : null;
  assertTypeWithdrawable(type);
  assertWithdrawable(account.balance, amount);
  assertAvailableAfterHold(amount, await getSavingsPosition(db as Prisma.TransactionClient, account.associationId, account.memberId));
  if (type?.monthlyWithdrawalLimit) {
    assertWithinMonthlyLimit(type.monthlyWithdrawalLimit, await withdrawnThisMonth(db, account.memberId, type.id, now), amount);
  }
}

export const cooperativeWithdrawalsService = {
  include,

  /** What a member sees on My Withdrawal: per withdrawable account the limit, what is left this month, and the totals. */
  async memberSummary(associationId: number, memberId: number, now: Date = new Date()) {
    const accounts = await prisma.savingsAccount.findMany({
      where: { associationId, memberId, status: 'ACTIVE' },
      include: { accountTypeRef: true },
      orderBy: { openedAt: 'asc' },
    });
    const withdrawable = accounts.filter((a) => a.accountTypeRef?.isWithdrawable !== false);
    const { start, end } = monthWindow(now);

    const [totals, last, pending] = await Promise.all([
      prisma.savingsTransaction.aggregate({
        where: { type: 'WITHDRAWAL', savingsAccount: { memberId, associationId } },
        _sum: { amount: true },
      }),
      prisma.savingsWithdrawalRequest.findFirst({ where: { associationId, memberId, status: 'APPROVED' }, orderBy: { approvedAt: 'desc' } }),
      prisma.savingsWithdrawalRequest.findMany({ where: { associationId, memberId, status: { in: [...PENDING] } }, select: { savingsAccountId: true } }),
    ]);

    const items = await Promise.all(
      withdrawable.map(async (account) => {
        const type = account.accountTypeRef;
        const used = type ? await withdrawnThisMonth(prisma, memberId, type.id, now) : new Decimal(0);
        const limit = type?.monthlyWithdrawalLimit ?? null;
        return {
          savingsAccountId: account.id,
          accountNumber: account.accountNumber,
          accountTypeName: type?.name ?? 'Savings',
          balance: account.balance,
          monthlyLimit: limit,
          remainingThisMonth: limit ? Decimal.max(limit.minus(used), new Decimal(0)) : null,
          hasPending: pending.some((p) => p.savingsAccountId === account.id),
        };
      }),
    );

    return {
      accounts: items,
      totalBalance: items.reduce((sum, item) => sum.plus(item.balance), new Decimal(0)),
      totalWithdrawals: totals._sum.amount ?? new Decimal(0),
      monthlyLimit: items.reduce<Decimal | null>((sum, item) => (item.monthlyLimit ? (sum ?? new Decimal(0)).plus(item.monthlyLimit) : sum), null),
      lastWithdrawal: last ? { amount: last.amount, at: last.approvedAt } : null,
      window: { start, end },
    };
  },

  async create(
    associationId: number,
    memberId: number,
    input: { savingsAccountId: number; amount: number; reason?: string },
    now: Date = new Date(),
  ) {
    const account = await prisma.savingsAccount.findFirst({ where: { id: input.savingsAccountId, associationId, memberId, status: 'ACTIVE' } });
    if (!account) throw new RuleError('Savings account not found or inactive.', 404, 'ACCOUNT_NOT_FOUND');

    const amount = new Decimal(input.amount);
    await assertEligible(prisma, account, amount, now);

    const pending = await prisma.savingsWithdrawalRequest.count({
      where: { associationId, savingsAccountId: account.id, status: { in: [...PENDING] } },
    });
    if (pending > 0) {
      throw new RuleError('You already have a withdrawal waiting for a decision on this account.', 409, 'WITHDRAWAL_PENDING');
    }

    const twoStage = await getTwoStageWithdrawal(associationId);
    // The count above is a friendly early answer; the database's one-open-request-per-account index is what stops two racing requests.
    const created = await prisma.savingsWithdrawalRequest
      .create({
        data: {
          associationId,
          memberId,
          savingsAccountId: account.id,
          amount,
          reason: input.reason,
          twoStage,
          status: twoStage ? 'PENDING_REVIEW' : 'PENDING_APPROVAL',
        },
        include,
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2002') {
          throw new RuleError('You already have a withdrawal waiting for a decision on this account.', 409, 'WITHDRAWAL_PENDING');
        }
        throw error;
      });

    void notifyOfficers(
      associationId,
      [twoStage ? PERMISSIONS.COOPERATIVE_WITHDRAWAL_REVIEW : PERMISSIONS.COOPERATIVE_WITHDRAWAL_APPROVE],
      {
        memberId,
        entityId: created.id,
        pushType: 'savings.withdrawal_submitted',
        title: twoStage ? 'Withdrawal awaiting review' : 'Withdrawal awaiting approval',
        what: (name) => `${name} asked to withdraw ${naira(amount.toString())}.`,
      },
    );

    return formatWithdrawal(created);
  },

  async list(
    associationId: number,
    options: { page?: number; limit?: number; status?: Row['status']; memberId?: number } = {},
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const where: Prisma.SavingsWithdrawalRequestWhereInput = {
      associationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.memberId ? { memberId: options.memberId } : {}),
    };
    const [rows, totalCount] = await Promise.all([
      prisma.savingsWithdrawalRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.savingsWithdrawalRequest.count({ where }),
    ]);
    return {
      requests: rows.map(formatWithdrawal),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: page * limit < totalCount },
    };
  },

  async getOne(associationId: number, id: number) {
    return prisma.savingsWithdrawalRequest.findFirst({ where: { id, associationId }, include });
  },

  /** Stage one. FORWARD hands it to the approver (balance and limits are checked again); REJECT ends it with a reason. */
  async review(
    associationId: number,
    id: number,
    reviewerUserId: number,
    decision: { decision: 'FORWARD'; comment?: string } | { decision: 'REJECT'; reason: string },
    now: Date = new Date(),
  ) {
    const request = await prisma.savingsWithdrawalRequest.findFirst({ where: { id, associationId }, include });
    if (!request) throw new RuleError('This withdrawal request does not exist.', 404, 'NOT_FOUND');
    assertCanReview(reviewerUserId, request.member.userId);

    if (decision.decision === 'FORWARD') {
      const account = await prisma.savingsAccount.findUniqueOrThrow({ where: { id: request.savingsAccountId } });
      await assertEligible(prisma, account, request.amount, now);
    }

    const claimed = await prisma.savingsWithdrawalRequest.updateMany({
      where: { id, associationId, status: 'PENDING_REVIEW' },
      data:
        decision.decision === 'FORWARD'
          ? { status: 'PENDING_APPROVAL', reviewedBy: reviewerUserId, reviewedAt: new Date(), reviewComment: decision.comment }
          : {
              status: 'REJECTED',
              reviewedBy: reviewerUserId,
              reviewedAt: new Date(),
              rejectedBy: reviewerUserId,
              rejectedAt: new Date(),
              rejectionReason: decision.reason,
            },
    });
    if (claimed.count !== 1) {
      throw new RuleError('This withdrawal is not waiting for review.', 409, 'ALREADY_DECIDED');
    }

    if (decision.decision === 'FORWARD') {
      void notifyOfficers(associationId, [PERMISSIONS.COOPERATIVE_WITHDRAWAL_APPROVE], {
        memberId: request.memberId,
        entityId: id,
        pushType: 'savings.withdrawal_submitted',
        title: 'Withdrawal awaiting approval',
        what: (name) => `${name}'s withdrawal of ${naira(request.amount.toString())} passed review and needs final approval.`,
      });
    } else {
      await notifyMember(associationId, request.memberId, {
        entityId: id,
        pushType: 'savings.withdrawal_decision',
        title: 'Withdrawal not approved',
        message: `Your withdrawal of ${naira(request.amount.toString())} was not approved: ${decision.reason}`,
      });
    }

    return formatWithdrawal(await prisma.savingsWithdrawalRequest.findFirstOrThrow({ where: { id, associationId }, include }));
  },

  /** Final approval: re-checks everything, then moves the money in one transaction and records who paid it out and how. */
  async approve(
    associationId: number,
    id: number,
    approverUserId: number,
    payout: { payoutMethod: string; payoutReference?: string; comment?: string },
    now: Date = new Date(),
  ) {
    const request = await prisma.savingsWithdrawalRequest.findFirst({ where: { id, associationId }, include });
    if (!request) throw new RuleError('This withdrawal request does not exist.', 404, 'NOT_FOUND');
    assertCanApprove({
      approverUserId,
      requesterUserId: request.member.userId,
      reviewerUserId: request.reviewedBy,
      twoStage: request.twoStage,
    });

    const transaction = await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.savingsWithdrawalRequest.updateMany({
          where: { id, associationId, status: 'PENDING_APPROVAL' },
          data: {
            status: 'APPROVED',
            approvedBy: approverUserId,
            approvedAt: new Date(),
            approvalComment: payout.comment,
            payoutMethod: payout.payoutMethod,
            payoutReference: payout.payoutReference,
          },
        });
        if (claimed.count !== 1) {
          throw new RuleError('This withdrawal is not waiting for approval.', 409, 'ALREADY_DECIDED');
        }

        const account = await tx.savingsAccount.findUniqueOrThrow({ where: { id: request.savingsAccountId } });
        // The balance, the loan hold and the monthly limit may all have changed since the member asked.
        await assertEligible(tx, account, request.amount, now);

        const posted = await applySavingsMovement(tx, {
          associationId,
          userId: approverUserId,
          savingsAccountId: request.savingsAccountId,
          type: 'WITHDRAWAL',
          amount: request.amount,
          paymentMethod: payout.payoutMethod,
          reference: payout.payoutReference || `WD-REQ-${id}`,
          notes: `Withdrawal request #${id}, approved`,
        });
        await tx.savingsWithdrawalRequest.update({ where: { id }, data: { savingsTransactionId: posted.id } });
        return posted;
      },
      { timeout: 30000 },
    );

    await syncSavingsToAccounting(transaction, request.savingsAccountId, approverUserId);
    await notifyMember(associationId, request.memberId, {
      entityId: id,
      pushType: 'savings.withdrawal_decision',
      title: 'Withdrawal approved',
      message: `Your withdrawal of ${naira(request.amount.toString())} has been approved and paid out.`,
    });

    return formatWithdrawal(await prisma.savingsWithdrawalRequest.findFirstOrThrow({ where: { id, associationId }, include }));
  },

  /** Rejecting at the final stage. (Rejecting at stage one goes through `review`.) */
  async reject(associationId: number, id: number, userId: number, reason: string) {
    const request = await prisma.savingsWithdrawalRequest.findFirst({ where: { id, associationId }, include });
    if (!request) throw new RuleError('This withdrawal request does not exist.', 404, 'NOT_FOUND');
    assertCanApprove({ approverUserId: userId, requesterUserId: request.member.userId, reviewerUserId: request.reviewedBy, twoStage: request.twoStage });

    const claimed = await prisma.savingsWithdrawalRequest.updateMany({
      where: { id, associationId, status: 'PENDING_APPROVAL' },
      data: { status: 'REJECTED', rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason },
    });
    if (claimed.count !== 1) {
      throw new RuleError('This withdrawal is not waiting for approval.', 409, 'ALREADY_DECIDED');
    }

    await notifyMember(associationId, request.memberId, {
      entityId: id,
      pushType: 'savings.withdrawal_decision',
      title: 'Withdrawal not approved',
      message: `Your withdrawal of ${naira(request.amount.toString())} was not approved: ${reason}`,
    });
    return formatWithdrawal(await prisma.savingsWithdrawalRequest.findFirstOrThrow({ where: { id, associationId }, include }));
  },

  /** A member can withdraw their own request while it is still waiting. */
  async cancel(associationId: number, id: number, memberId: number) {
    const claimed = await prisma.savingsWithdrawalRequest.updateMany({
      where: { id, associationId, memberId, status: { in: [...PENDING] } },
      data: { status: 'CANCELLED' },
    });
    if (claimed.count !== 1) {
      throw new RuleError("This request can't be cancelled any more.", 409, 'NOT_CANCELLABLE');
    }
    return formatWithdrawal(await prisma.savingsWithdrawalRequest.findFirstOrThrow({ where: { id, associationId }, include }));
  },
};

