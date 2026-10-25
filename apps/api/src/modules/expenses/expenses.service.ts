import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { deleteFile, getPresignedUrl, uploadFile } from '../../lib/storage';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { accountingPeriodsService } from '../accounting/accounting-periods.service';
import { accountingService, cashAccountIds } from '../accounting/accounting.service';
import { balanceOf, lagosDayKey, periodCovers } from '../accounting/accounting-rules';
import { SettingsService } from '../settings/settings.service';
import {
  assertReadyToSend,
  budgetPosition,
  ExpenseRuleError,
  isEditableStatus,
  MAX_RECEIPT_BYTES,
  parseAmount,
  parseExpenseDate,
  receiptLimit,
  sniffReceipt,
  suffixOf,
  voucherNumberFor,
  type BudgetPosition,
  type ExpenseStatus,
  type VoucherInput,
} from './expense-rules';

const rule = (message: string, status: 400 | 403 | 404 | 409 | 503, code: string) => new ExpenseRuleError(message, status, code);

const include = {
  category: { select: { id: true, code: true, name: true } },
  paidFrom: { select: { id: true, code: true, name: true } },
} as const;

type VoucherRow = Prisma.ExpenseVoucherGetPayload<{ include: typeof include }>;

async function audit(associationId: number, userId: number, action: string, recordId: number, values: object, before?: object) {
  await prisma.auditLog.create({
    data: { associationId, userId, action, tableName: 'expense_vouchers', recordId, newValues: values as Prisma.InputJsonValue, ...(before ? { oldValues: before as Prisma.InputJsonValue } : {}) },
  });
}

/** The email of each person named on a voucher, in one query. */
async function emailsOf(rows: VoucherRow[]): Promise<Map<number, string>> {
  const ids = [...new Set(rows.flatMap((r) => [r.createdBy, r.approvedBy, r.rejectedBy, r.voidedBy]).filter((id): id is number => typeof id === 'number'))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  return new Map(users.map((u) => [u.id, u.email]));
}

function format(v: VoucherRow, emails: Map<number, string>) {
  const who = (id: number | null) => (id === null ? null : (emails.get(id) ?? null));
  return {
    id: v.id,
    voucherNumber: v.voucherNumber,
    expenseDate: v.expenseDate,
    payee: v.payee,
    description: v.description,
    amount: v.amount,
    category: v.category,
    paidFrom: v.paidFrom,
    reference: v.reference,
    noReceiptReason: v.noReceiptReason,
    hasReceipt: !!v.receiptKey,
    receiptType: v.receiptType,
    status: v.status,
    createdBy: v.createdBy,
    createdByEmail: who(v.createdBy),
    submittedAt: v.submittedAt,
    approvedBy: v.approvedBy,
    approvedByEmail: who(v.approvedBy),
    approvedAt: v.approvedAt,
    overBudget: v.overBudget,
    rejectedByEmail: who(v.rejectedBy),
    rejectedAt: v.rejectedAt,
    rejectionReason: v.rejectionReason,
    voidedByEmail: who(v.voidedBy),
    voidedAt: v.voidedAt,
    voidReason: v.voidReason,
    journalEntryId: v.journalEntryId,
    reversalEntryId: v.reversalEntryId,
    createdAt: v.createdAt,
  };
}

async function load(associationId: number, id: number): Promise<VoucherRow> {
  const row = await prisma.expenseVoucher.findFirst({ where: { id, associationId }, include });
  if (!row) throw rule('That expense could not be found.', 404, 'EXPENSE_NOT_FOUND');
  return row;
}

async function receiptLimitFor(associationId: number): Promise<Decimal> {
  return receiptLimit(await SettingsService.getSetting(associationId, 'financial', 'receiptRequiredAbove'));
}

/** The category must be an active expense account, and the paid-from account an active cash or bank account, of this association. */
async function checkAccounts(associationId: number, categoryAccountId: number, paidFromAccountId: number): Promise<void> {
  const category = await prisma.chartOfAccount.findFirst({ where: { id: categoryAccountId, associationId } });
  if (!category || category.type !== 'EXPENSE') throw rule('Choose a spending category from your chart of accounts.', 400, 'INVALID_CATEGORY');
  if (!category.isActive) throw rule(`The category "${category.name}" is switched off. Choose another.`, 400, 'INVALID_CATEGORY');
  const cash = await cashAccountIds(associationId);
  const paidFrom = cash.includes(paidFromAccountId) ? await prisma.chartOfAccount.findFirst({ where: { id: paidFromAccountId, associationId } }) : null;
  if (!paidFrom) throw rule('Choose a cash or bank account it was paid from.', 400, 'INVALID_PAID_FROM');
  if (!paidFrom.isActive) throw rule(`The account "${paidFrom.name}" is switched off. Choose another.`, 400, 'INVALID_PAID_FROM');
}

/** Where a category stands against the budget in force on the voucher's date, or null when no budget line covers it. */
async function budgetFor(associationId: number, categoryAccountId: number, date: Date, amount: Decimal.Value): Promise<BudgetPosition | null> {
  const budgets = await prisma.budget.findMany({
    where: { associationId, status: 'ACTIVE', items: { some: { accountId: categoryAccountId } } },
    include: { items: { where: { accountId: categoryAccountId } } },
  });
  const budget = budgets.find((b) => periodCovers(b, date));
  if (!budget || budget.items.length === 0) return null;
  const planned = budget.items.reduce((sum, i) => sum.plus(i.annualAmount), new Decimal(0));

  const account = await prisma.chartOfAccount.findUnique({ where: { id: categoryAccountId }, select: { normalBalance: true } });
  const sums = await prisma.journalEntryLine.aggregate({
    where: { accountId: categoryAccountId, journalEntry: { associationId, status: 'POSTED', entryDate: { gte: budget.startDate, lte: budget.endDate } } },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const spent = balanceOf((account?.normalBalance ?? 'DEBIT') as 'DEBIT' | 'CREDIT', sums._sum.debitAmount ?? 0, sums._sum.creditAmount ?? 0);
  return budgetPosition(budget, planned, spent, amount);
}

/**
 * How many officers other than the one who recorded a voucher can approve it: people of this association who are active and hold
 * `payments.approve` through a role they have. Zero means nobody can decide it yet (for instance the only approver recorded it).
 */
async function countOtherApprovers(associationId: number, recordedBy: number): Promise<number> {
  const holders = await prisma.userRole.findMany({
    where: {
      associationId,
      isActive: true,
      userId: { not: recordedBy },
      user: { isActive: true },
      role: { associationId, permissions: { some: { permission: { key: 'payments.approve' } } } },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return holders.length;
}

async function nextNumber(associationId: number): Promise<string> {
  const year = lagosDayKey(new Date()).slice(0, 4);
  const latest = await prisma.expenseVoucher.findFirst({ where: { associationId, voucherNumber: { startsWith: `EXP-${year}-` } }, orderBy: { voucherNumber: 'desc' }, select: { voucherNumber: true } });
  return voucherNumberFor(year, suffixOf(latest?.voucherNumber));
}

const isUniqueViolation = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export const expensesService = {
  /** What the form offers: the spending categories, the accounts money can be paid from, and the receipt limit. */
  async getOptions(associationId: number) {
    const [categories, cash, limit] = await Promise.all([
      prisma.chartOfAccount.findMany({ where: { associationId, type: 'EXPENSE', isActive: true }, select: { id: true, code: true, name: true, parentId: true }, orderBy: { code: 'asc' } }),
      cashAccountIds(associationId),
      receiptLimitFor(associationId),
    ]);
    const paidFrom = cash.length ? await prisma.chartOfAccount.findMany({ where: { associationId, id: { in: cash }, isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }) : [];
    return { categories, paidFrom, receiptRequiredAbove: limit };
  },

  /** How a category stands against its budget if this amount were spent on this date. */
  async checkBudget(associationId: number, categoryAccountId: number, amountValue: unknown, dateValue: unknown) {
    const amount = parseAmount(amountValue);
    const date = parseExpenseDate(dateValue);
    const category = await prisma.chartOfAccount.findFirst({ where: { id: categoryAccountId, associationId, type: 'EXPENSE' }, select: { id: true } });
    if (!category) throw rule('Choose a spending category from your chart of accounts.', 400, 'INVALID_CATEGORY');
    return budgetFor(associationId, categoryAccountId, date, amount);
  },

  async list(
    associationId: number,
    options: { status?: ExpenseStatus; search?: string; from?: Date; to?: Date; categoryAccountId?: number; createdBy?: number; page?: number; limit?: number },
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const where: Prisma.ExpenseVoucherWhereInput = { associationId };
    if (options.status) where.status = options.status;
    if (options.categoryAccountId) where.categoryAccountId = options.categoryAccountId;
    if (options.createdBy) where.createdBy = options.createdBy;
    if (options.from || options.to) where.expenseDate = { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) };
    if (options.search) {
      where.OR = [
        { payee: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { voucherNumber: { contains: options.search, mode: 'insensitive' } },
        { reference: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    const [rows, totalCount, approved, waiting] = await Promise.all([
      prisma.expenseVoucher.findMany({ where, include, orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.expenseVoucher.count({ where }),
      // The money spent across the whole list: only approved vouchers are in the books
      prisma.expenseVoucher.aggregate({ where: { ...where, status: 'APPROVED' }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.expenseVoucher.count({ where: { associationId, status: 'PENDING_APPROVAL' } }),
    ]);
    const emails = await emailsOf(rows);
    return {
      vouchers: rows.map((r) => format(r, emails)),
      totals: { approvedAmount: new Decimal(approved._sum.amount ?? 0), approvedCount: approved._count._all, waitingForApproval: waiting },
      pagination: { page, limit, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), hasMore: page * limit < totalCount },
    };
  },

  async get(associationId: number, id: number) {
    const row = await load(associationId, id);
    const emails = await emailsOf([row]);
    const budget = row.status === 'VOIDED' || row.status === 'APPROVED' ? null : await budgetFor(associationId, row.categoryAccountId, row.expenseDate, row.amount);
    // Only worth knowing while it waits: is there anyone else who can decide it?
    const otherApprovers = row.status === 'PENDING_APPROVAL' ? await countOtherApprovers(associationId, row.createdBy) : null;
    return { ...format(row, emails), budget, otherApprovers };
  },

  async create(associationId: number, userId: number, input: VoucherInput) {
    const amount = parseAmount(input.amount);
    const expenseDate = parseExpenseDate(input.expenseDate);
    await checkAccounts(associationId, input.categoryAccountId, input.paidFromAccountId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await prisma.expenseVoucher.create({
          data: {
            associationId,
            voucherNumber: await nextNumber(associationId),
            expenseDate,
            payee: input.payee,
            description: input.description,
            amount,
            categoryAccountId: input.categoryAccountId,
            paidFromAccountId: input.paidFromAccountId,
            reference: input.reference?.trim() || null,
            noReceiptReason: input.noReceiptReason?.trim() || null,
            createdBy: userId,
          },
          include,
        });
        await audit(associationId, userId, 'EXPENSE_CREATED', created.id, { voucherNumber: created.voucherNumber, amount: amount.toFixed(2) });
        return this.get(associationId, created.id);
      } catch (error) {
        // Another voucher took this number a moment ago: take the next one
        if (isUniqueViolation(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw rule('Could not number the voucher. Try again.', 409, 'NUMBERING_CONFLICT');
  },

  /** Only the officer who recorded a voucher can change it, while it is a draft or after it was rejected. */
  async update(associationId: number, userId: number, id: number, input: VoucherInput) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can change it.', 403, 'NOT_YOURS');
    if (!isEditableStatus(current.status)) throw rule('Only a draft, or a voucher that was rejected, can be changed.', 409, 'WRONG_STATUS');
    const amount = parseAmount(input.amount);
    const expenseDate = parseExpenseDate(input.expenseDate);
    await checkAccounts(associationId, input.categoryAccountId, input.paidFromAccountId);

    // Claim by status so a change and a send at the same moment cannot both succeed
    const claimed = await prisma.expenseVoucher.updateMany({
      where: { id, associationId, status: { in: ['DRAFT', 'REJECTED'] } },
      data: {
        expenseDate,
        payee: input.payee,
        description: input.description,
        amount,
        categoryAccountId: input.categoryAccountId,
        paidFromAccountId: input.paidFromAccountId,
        reference: input.reference?.trim() || null,
        noReceiptReason: input.noReceiptReason?.trim() || null,
        // Changing a rejected voucher makes it a draft again, ready to send
        status: 'DRAFT',
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null,
      },
    });
    if (claimed.count === 0) throw rule('Only a draft, or a voucher that was rejected, can be changed.', 409, 'WRONG_STATUS');
    await audit(associationId, userId, 'EXPENSE_UPDATED', id, { amount: amount.toFixed(2), payee: input.payee }, { amount: new Decimal(current.amount).toFixed(2), payee: current.payee });
    return this.get(associationId, id);
  },

  async remove(associationId: number, userId: number, id: number) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can delete it.', 403, 'NOT_YOURS');
    if (current.status !== 'DRAFT') throw rule('Only a draft can be deleted. Void an approved expense instead.', 409, 'WRONG_STATUS');
    const gone = await prisma.expenseVoucher.deleteMany({ where: { id, associationId, status: 'DRAFT' } });
    if (gone.count === 0) throw rule('Only a draft can be deleted.', 409, 'WRONG_STATUS');
    if (current.receiptKey) await deleteFile(current.receiptKey);
    await audit(associationId, userId, 'EXPENSE_DELETED', id, { voucherNumber: current.voucherNumber });
    return { removed: true };
  },

  async attachReceipt(associationId: number, userId: number, id: number, file: { buffer: Buffer; size: number }) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can attach its receipt.', 403, 'NOT_YOURS');
    if (!isEditableStatus(current.status)) throw rule('The receipt can only be changed on a draft, or on a voucher that was rejected.', 409, 'WRONG_STATUS');
    if (file.size > MAX_RECEIPT_BYTES) throw rule('That file is larger than 5MB. Choose a smaller one.', 400, 'RECEIPT_TOO_LARGE');
    const kind = sniffReceipt(file.buffer);
    if (!kind) throw rule('The receipt must be a JPEG, PNG or WebP picture, or a PDF.', 400, 'RECEIPT_TYPE');

    const key = `expense-receipts/${associationId}/${id}-${Date.now()}${kind.ext}`;
    try {
      await uploadFile(key, file.buffer, kind.mime);
    } catch (error) {
      // File storage being down is not the officer's fault, and nothing has changed on the voucher: say so plainly
      console.error('Expense receipt upload failed:', error);
      throw rule('The receipt could not be saved because file storage cannot be reached. Try again in a moment.', 503, 'STORAGE_UNAVAILABLE');
    }
    try {
      await prisma.expenseVoucher.update({ where: { id }, data: { receiptKey: key, receiptType: kind.mime } });
    } catch (error) {
      await deleteFile(key); // never leave an orphaned receipt behind
      throw error;
    }
    if (current.receiptKey) await deleteFile(current.receiptKey);
    await audit(associationId, userId, 'EXPENSE_RECEIPT_ATTACHED', id, { type: kind.mime });
    return this.get(associationId, id);
  },

  async removeReceipt(associationId: number, userId: number, id: number) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can remove its receipt.', 403, 'NOT_YOURS');
    if (!isEditableStatus(current.status)) throw rule('The receipt can only be changed on a draft, or on a voucher that was rejected.', 409, 'WRONG_STATUS');
    if (!current.receiptKey) return this.get(associationId, id);
    await prisma.expenseVoucher.update({ where: { id }, data: { receiptKey: null, receiptType: null } });
    await deleteFile(current.receiptKey);
    await audit(associationId, userId, 'EXPENSE_RECEIPT_REMOVED', id, {});
    return this.get(associationId, id);
  },

  /** A short-lived link to see the receipt. */
  async receiptUrl(associationId: number, id: number, requestHost?: string) {
    const row = await load(associationId, id);
    if (!row.receiptKey) throw rule('This expense has no receipt.', 404, 'NO_RECEIPT');
    return { url: await getPresignedUrl(row.receiptKey, 3600, requestHost), type: row.receiptType };
  },

  /** Send a draft for approval. It must carry its receipt (or the reason there is none), and its date must be in an open period. */
  async submit(associationId: number, userId: number, id: number) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can send it.', 403, 'NOT_YOURS');
    if (current.status !== 'DRAFT') throw rule('Only a draft can be sent for approval.', 409, 'WRONG_STATUS');
    assertReadyToSend(current, await receiptLimitFor(associationId));
    await checkAccounts(associationId, current.categoryAccountId, current.paidFromAccountId);
    await accountingPeriodsService.assertDateIsPostable(associationId, current.expenseDate);

    const claimed = await prisma.expenseVoucher.updateMany({ where: { id, associationId, status: 'DRAFT' }, data: { status: 'PENDING_APPROVAL', submittedAt: new Date() } });
    if (claimed.count === 0) throw rule('Only a draft can be sent for approval.', 409, 'WRONG_STATUS');
    await audit(associationId, userId, 'EXPENSE_SUBMITTED', id, { voucherNumber: current.voucherNumber });
    return this.get(associationId, id);
  },

  /** The officer who recorded it takes it back from the approver, to change it. */
  async withdraw(associationId: number, userId: number, id: number) {
    const current = await load(associationId, id);
    if (current.createdBy !== userId) throw rule('Only the officer who recorded this expense can take it back.', 403, 'NOT_YOURS');
    const claimed = await prisma.expenseVoucher.updateMany({ where: { id, associationId, status: 'PENDING_APPROVAL' }, data: { status: 'DRAFT', submittedAt: null } });
    if (claimed.count === 0) throw rule('Only a voucher waiting for approval can be taken back.', 409, 'WRONG_STATUS');
    await audit(associationId, userId, 'EXPENSE_WITHDRAWN', id, {});
    return this.get(associationId, id);
  },

  /**
   * Approve and post. A different officer from the one who recorded it. The voucher is claimed first (so two approvals at once cannot
   * both post), the entry is posted — debit the category, credit the account it was paid from — and if posting fails the claim is
   * undone so the voucher goes back to waiting.
   */
  async approve(associationId: number, approverId: number, id: number) {
    const current = await load(associationId, id);
    if (current.createdBy === approverId) throw rule('You recorded this expense, so another officer has to approve it.', 403, 'OWN_EXPENSE');
    if (current.status !== 'PENDING_APPROVAL') throw rule('Only an expense waiting for approval can be approved.', 409, 'WRONG_STATUS');
    await checkAccounts(associationId, current.categoryAccountId, current.paidFromAccountId);
    await accountingPeriodsService.assertDateIsPostable(associationId, current.expenseDate);
    const position = await budgetFor(associationId, current.categoryAccountId, current.expenseDate, current.amount);

    const claimed = await prisma.expenseVoucher.updateMany({
      where: { id, associationId, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date(), overBudget: !!position && position.overBy.gt(0) },
    });
    if (claimed.count === 0) throw rule('Only an expense waiting for approval can be approved.', 409, 'WRONG_STATUS');

    try {
      const amount = Number(new Decimal(current.amount).toFixed(2));
      const entry = await accountingService.createJournalEntry(
        associationId,
        approverId,
        {
          entryDate: current.expenseDate.toISOString(),
          description: `${current.category.name}: ${current.payee}`,
          reference: current.voucherNumber,
          lines: [
            { accountId: current.categoryAccountId, debitAmount: amount, creditAmount: 0, description: current.description },
            { accountId: current.paidFromAccountId, debitAmount: 0, creditAmount: amount, description: current.description },
          ],
        },
        { source: { type: 'ExpenseVoucher', id }, autoPost: true },
      );
      await prisma.expenseVoucher.update({ where: { id }, data: { journalEntryId: entry.id } });
    } catch (error) {
      await prisma.expenseVoucher.updateMany({
        where: { id, status: 'APPROVED', journalEntryId: null },
        data: { status: 'PENDING_APPROVAL', approvedBy: null, approvedAt: null, overBudget: false },
      });
      throw error;
    }
    await audit(associationId, approverId, 'EXPENSE_APPROVED', id, { voucherNumber: current.voucherNumber, amount: new Decimal(current.amount).toFixed(2), overBudget: !!position && position.overBy.gt(0) });
    return this.get(associationId, id);
  },

  async reject(associationId: number, deciderId: number, id: number, reason: string) {
    const current = await load(associationId, id);
    if (current.createdBy === deciderId) throw rule('You recorded this expense. To change it, take it back instead.', 403, 'OWN_EXPENSE');
    const claimed = await prisma.expenseVoucher.updateMany({
      where: { id, associationId, status: 'PENDING_APPROVAL' },
      data: { status: 'REJECTED', rejectedBy: deciderId, rejectedAt: new Date(), rejectionReason: reason },
    });
    if (claimed.count === 0) throw rule('Only an expense waiting for approval can be rejected.', 409, 'WRONG_STATUS');
    await audit(associationId, deciderId, 'EXPENSE_REJECTED', id, { voucherNumber: current.voucherNumber, reason });
    return this.get(associationId, id);
  },

  /**
   * Cancel an approved expense. It is never deleted: the books get the mirror image of the entry, dated today, and the voucher stays
   * visible as voided. If the reversal cannot be posted (for instance today falls in a closed period) nothing changes.
   */
  async voidVoucher(associationId: number, userId: number, id: number, reason: string) {
    const current = await load(associationId, id);
    if (current.status !== 'APPROVED' || !current.journalEntryId) throw rule('Only an approved expense can be voided.', 409, 'WRONG_STATUS');
    await accountingPeriodsService.assertDateIsPostable(associationId, new Date());

    const claimed = await prisma.expenseVoucher.updateMany({
      where: { id, associationId, status: 'APPROVED' },
      data: { status: 'VOIDED', voidedBy: userId, voidedAt: new Date(), voidReason: reason },
    });
    if (claimed.count === 0) throw rule('Only an approved expense can be voided.', 409, 'WRONG_STATUS');

    try {
      const reversal = await accountingIntegrationService.reverseJournalEntry(associationId, userId, current.journalEntryId, `Voided ${current.voucherNumber}: ${reason}`, current.voucherNumber);
      if (reversal) await prisma.expenseVoucher.update({ where: { id }, data: { reversalEntryId: reversal.id } });
    } catch (error) {
      await prisma.expenseVoucher.updateMany({ where: { id, status: 'VOIDED', reversalEntryId: null }, data: { status: 'APPROVED', voidedBy: null, voidedAt: null, voidReason: null } });
      throw error;
    }
    await audit(associationId, userId, 'EXPENSE_VOIDED', id, { voucherNumber: current.voucherNumber, reason });
    return this.get(associationId, id);
  },

  /** How many vouchers wait for an approver, for the dashboards. */
  async waitingCount(associationId: number, excludeCreatedBy?: number): Promise<number> {
    return prisma.expenseVoucher.count({ where: { associationId, status: 'PENDING_APPROVAL', ...(excludeCreatedBy ? { createdBy: { not: excludeCreatedBy } } : {}) } });
  },
};
