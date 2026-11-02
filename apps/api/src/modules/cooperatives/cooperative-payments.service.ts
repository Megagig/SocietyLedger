import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import { assertNotOwnRequest } from './cooperative-rules';
import { applySavingsMovement, syncSavingsToAccounting } from './savings-posting';
import { naira, notifyMember, notifyOfficers } from './cooperative-notify';

/**
 * A payment request is one bank transfer: one proof file and one or more lines (a savings type, an amount, and the month it is for).
 * The balance never moves while it is pending. Approval posts every line in ONE database transaction, so either all of them post or none
 * does; rejection leaves everything untouched.
 */

export interface PaymentLineInput {
  accountTypeId: number;
  /** Pins the line to one of the member's own accounts (older clients choose an account, not a type). Left out, the account of that type is used. */
  savingsAccountId?: number;
  amount: number;
  periodMonth: number;
  periodYear: number;
}

export interface PaymentRequestInput {
  lines: PaymentLineInput[];
  paymentDate: Date;
  bankAccountId?: number;
  reference?: string;
  memberNote?: string;
}

export interface PaymentReceipt {
  filename: string;
  filepath: string;
  fileSize?: number;
  mimeType?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const periodLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

const requestInclude = {
  member: { select: { firstName: true, lastName: true, memberId: true, userId: true } },
  lines: {
    include: {
      accountType: { select: { name: true, accountClass: true } },
      savingsAccount: { select: { accountNumber: true } },
    },
  },
} satisfies Prisma.CooperativePaymentRequestInclude;

type RequestRow = Prisma.CooperativePaymentRequestGetPayload<{ include: typeof requestInclude }>;

export function formatPaymentRequest(row: RequestRow) {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: `${row.member.firstName} ${row.member.lastName}`.trim(),
    memberNumber: row.member.memberId,
    totalAmount: row.totalAmount,
    paymentDate: row.paymentDate,
    bankAccountId: row.bankAccountId,
    reference: row.reference,
    memberNote: row.memberNote,
    filename: row.filename,
    hasReceipt: !!row.filepath,
    status: row.status,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    lines: row.lines.map((line) => ({
      id: line.id,
      accountTypeId: line.accountTypeId,
      savingsAccountId: line.savingsAccountId,
      accountNumber: line.savingsAccount?.accountNumber ?? null,
      accountTypeName: line.accountType.name,
      accountClass: line.accountType.accountClass,
      amount: line.amount,
      periodMonth: line.periodMonth,
      periodYear: line.periodYear,
      periodLabel: periodLabel(line.periodYear, line.periodMonth),
    })),
  };
}

/** Opens the member's account of a type the first time money arrives for it; reuses their active one afterwards. */
async function findOrOpenAccount(tx: Prisma.TransactionClient, associationId: number, memberId: number, typeId: number) {
  const existing = await tx.savingsAccount.findFirst({
    where: { associationId, memberId, accountTypeId: typeId },
    orderBy: [{ status: 'asc' }, { openedAt: 'asc' }],
  });
  if (existing) {
    if (existing.status !== 'ACTIVE') {
      throw new RuleError("The member's account for this savings type isn't active, so the payment can't be posted to it.", 409, 'ACCOUNT_INACTIVE');
    }
    return existing;
  }

  const type = await tx.cooperativeAccountType.findFirstOrThrow({ where: { id: typeId, associationId } });
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await tx.savingsAccount.count({ where: { associationId } });
  return tx.savingsAccount.create({
    data: {
      associationId,
      memberId,
      accountNumber: `SAV-${year}-${String(count + 1).padStart(6, '0')}`,
      accountType: 'REGULAR',
      accountTypeId: type.id,
      monthlyContribution: type.defaultMonthlyAmount,
    },
  });
}

/** The account the member chose on an older client: theirs, in this association, and still open. */
async function pinnedAccount(tx: Prisma.TransactionClient, associationId: number, memberId: number, savingsAccountId: number) {
  const account = await tx.savingsAccount.findFirst({ where: { id: savingsAccountId, associationId, memberId } });
  if (!account || account.status !== 'ACTIVE') {
    throw new RuleError("The savings account for this payment isn't open, so it can't be posted.", 409, 'ACCOUNT_INACTIVE');
  }
  return account;
}

export const cooperativePaymentsService = {
  requestInclude,

  /** Checked BEFORE the proof is uploaded, so a bad request never leaves an orphaned file in storage. */
  async validateNewRequest(associationId: number, input: PaymentRequestInput) {
    const typeIds = [...new Set(input.lines.map((line) => line.accountTypeId))];
    const types = await prisma.cooperativeAccountType.findMany({ where: { id: { in: typeIds }, associationId, isActive: true }, select: { id: true } });
    if (types.length !== typeIds.length) {
      throw new RuleError('One of the savings types is not available any more. Refresh and choose again.', 400, 'TYPE_UNAVAILABLE');
    }
    if (input.bankAccountId) {
      const bank = await prisma.associationBankAccount.findFirst({ where: { id: input.bankAccountId, associationId, isActive: true } });
      if (!bank) throw new RuleError('That bank account is not available.', 400, 'BANK_UNAVAILABLE');
    }
  },

  async createRequest(associationId: number, memberId: number, input: PaymentRequestInput, receipt: PaymentReceipt) {
    await this.validateNewRequest(associationId, input);

    // The total is worked out here from the lines, never taken from the client.
    const total = input.lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));

    const created = await prisma.cooperativePaymentRequest.create({
      data: {
        associationId,
        memberId,
        totalAmount: total,
        paymentDate: input.paymentDate,
        bankAccountId: input.bankAccountId,
        reference: input.reference,
        memberNote: input.memberNote,
        filename: receipt.filename,
        filepath: receipt.filepath,
        fileSize: receipt.fileSize,
        mimeType: receipt.mimeType,
        lines: {
          create: input.lines.map((line) => ({
            accountTypeId: line.accountTypeId,
            savingsAccountId: line.savingsAccountId,
            amount: new Decimal(line.amount),
            periodMonth: line.periodMonth,
            periodYear: line.periodYear,
          })),
        },
      },
      include: requestInclude,
    });

    void notifyOfficers(associationId, [PERMISSIONS.COOPERATIVE_SAVINGS_MANAGE], {
      memberId,
      entityId: created.id,
      pushType: 'savings.deposit_submitted',
      title: 'Savings payment awaiting confirmation',
      what: (name) => `${name} submitted a ${naira(total.toString())} payment to confirm.`,
    });

    return formatPaymentRequest(created);
  },

  async listRequests(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
      memberId?: number;
      savingsAccountId?: number;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const where: Prisma.CooperativePaymentRequestWhereInput = {
      associationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.memberId ? { memberId: options.memberId } : {}),
      ...(options.savingsAccountId ? { lines: { some: { savingsAccountId: options.savingsAccountId } } } : {}),
      ...(options.from || options.to ? { createdAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } } : {}),
    };
    const [rows, totalCount] = await Promise.all([
      prisma.cooperativePaymentRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cooperativePaymentRequest.count({ where }),
    ]);
    return {
      requests: rows.map(formatPaymentRequest),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: page * limit < totalCount },
    };
  },

  /** Raw row (with the storage key) — for ownership checks and the receipt, never sent to a client. */
  getRow(associationId: number, id: number) {
    return prisma.cooperativePaymentRequest.findFirst({ where: { id, associationId } });
  },

  async approve(associationId: number, id: number, reviewerUserId: number) {
    const request = await prisma.cooperativePaymentRequest.findFirst({ where: { id, associationId }, include: requestInclude });
    if (!request) throw new RuleError('This payment request does not exist.', 404, 'NOT_FOUND');
    assertNotOwnRequest(reviewerUserId, request.member.userId);

    const posted = await prisma.$transaction(
      async (tx) => {
        // Claimed inside the same transaction as the postings: if any line fails, the claim is rolled back with them and the request
        // stays in the queue, and two officers (or a double click) can never credit it twice.
        const claimed = await tx.cooperativePaymentRequest.updateMany({
          where: { id, associationId, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedBy: reviewerUserId, reviewedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new RuleError('This payment request has already been decided.', 409, 'ALREADY_DECIDED');
        }

        const results: Array<{ transaction: Awaited<ReturnType<typeof applySavingsMovement>>; accountId: number }> = [];
        for (const line of request.lines) {
          const account = line.savingsAccountId
            ? await pinnedAccount(tx, associationId, request.memberId, line.savingsAccountId)
            : await findOrOpenAccount(tx, associationId, request.memberId, line.accountTypeId);
          const transaction = await applySavingsMovement(tx, {
            associationId,
            userId: reviewerUserId,
            savingsAccountId: account.id,
            type: 'DEPOSIT',
            amount: line.amount,
            paymentMethod: 'BANK_TRANSFER',
            reference: request.reference || `PAY-REQ-${request.id}`,
            notes: `Payment request #${request.id}, ${line.accountType.name} for ${periodLabel(line.periodYear, line.periodMonth)}`,
          });
          await tx.cooperativePaymentLine.update({
            where: { id: line.id },
            data: { savingsAccountId: account.id, savingsTransactionId: transaction.id },
          });
          results.push({ transaction, accountId: account.id });
        }
        return results;
      },
      { timeout: 30000 },
    );

    for (const { transaction, accountId } of posted) {
      await syncSavingsToAccounting(transaction, accountId, reviewerUserId);
    }

    await notifyMember(associationId, request.memberId, {
      entityId: request.id,
      pushType: 'savings.deposit_decision',
      title: 'Savings payment approved',
      message: `Your payment of ${naira(request.totalAmount.toString())} has been confirmed and added to your savings.`,
    });

    return formatPaymentRequest(await prisma.cooperativePaymentRequest.findFirstOrThrow({ where: { id, associationId }, include: requestInclude }));
  },

  async reject(associationId: number, id: number, reviewerUserId: number, reason: string) {
    const request = await prisma.cooperativePaymentRequest.findFirst({ where: { id, associationId }, include: requestInclude });
    if (!request) throw new RuleError('This payment request does not exist.', 404, 'NOT_FOUND');
    assertNotOwnRequest(reviewerUserId, request.member.userId);

    const claimed = await prisma.cooperativePaymentRequest.updateMany({
      where: { id, associationId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedBy: reviewerUserId, reviewedAt: new Date(), rejectionReason: reason },
    });
    if (claimed.count !== 1) {
      throw new RuleError('This payment request has already been decided.', 409, 'ALREADY_DECIDED');
    }

    await notifyMember(associationId, request.memberId, {
      entityId: request.id,
      pushType: 'savings.deposit_decision',
      title: 'Savings payment not approved',
      message: `Your payment of ${naira(request.totalAmount.toString())} was not approved: ${reason}`,
    });

    return formatPaymentRequest(await prisma.cooperativePaymentRequest.findFirstOrThrow({ where: { id, associationId }, include: requestInclude }));
  },
};
