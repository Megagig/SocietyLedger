import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { runAsCashCollection } from '../../services/accounting-integration.service';
import { CashRuleError, collectionRemaining } from './cash-rules';
import { assertCashEnabled, recordCashItem, type CashItemInput, type RecordedItem } from './cash-record-items';
import { notifyCashReceipt } from './cash-notifications';

const MAX_ITEMS_PER_RECEIPT = 20;
// A receipt row with no items older than this was abandoned mid-save (the request died), so a retry may start over.
const ABANDONED_AFTER_MS = 2 * 60_000;

const num = (d: Decimal.Value | null | undefined) => Number(d ?? 0);

/** Officers' display names: their member profile when they have one, otherwise their sign-in email. */
export async function officerNames(userIds: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } },
  });
  return new Map(users.map((u) => [u.id, u.member ? `${u.member.firstName} ${u.member.lastName}`.trim() : u.email]));
}

/** Collected (active receipts) and already lodged (pending + verified allocations) per collection. */
export async function collectionTotals(collectionIds: number[]): Promise<Map<number, { collected: Decimal; allocated: Decimal; receipts: number }>> {
  const totals = new Map<number, { collected: Decimal; allocated: Decimal; receipts: number }>();
  if (collectionIds.length === 0) return totals;

  const [receipts, allocations] = await Promise.all([
    prisma.cashReceipt.groupBy({
      by: ['collectionId'],
      where: { collectionId: { in: collectionIds }, status: 'ACTIVE' },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.cashLodgmentAllocation.groupBy({
      by: ['collectionId'],
      where: { collectionId: { in: collectionIds }, lodgment: { status: { in: ['PENDING', 'VERIFIED'] } } },
      _sum: { amount: true },
    }),
  ]);

  for (const id of collectionIds) totals.set(id, { collected: new Decimal(0), allocated: new Decimal(0), receipts: 0 });
  for (const r of receipts) {
    const t = totals.get(r.collectionId)!;
    t.collected = new Decimal(r._sum.totalAmount ?? 0);
    t.receipts = r._count._all;
  }
  for (const a of allocations) totals.get(a.collectionId)!.allocated = new Decimal(a._sum.amount ?? 0);
  return totals;
}

function shapeCollection(
  c: { id: number; title: string; meetingId: number | null; collectedBy: number; status: string; notes: string | null; openedAt: Date; closedAt: Date | null },
  totals: { collected: Decimal; allocated: Decimal; receipts: number } | undefined,
  names: Map<number, string>,
) {
  const t = totals ?? { collected: new Decimal(0), allocated: new Decimal(0), receipts: 0 };
  return {
    id: c.id,
    title: c.title,
    meetingId: c.meetingId,
    status: c.status,
    notes: c.notes,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    collectedBy: { id: c.collectedBy, name: names.get(c.collectedBy) ?? 'Unknown officer' },
    receiptCount: t.receipts,
    collected: num(t.collected),
    lodged: num(t.allocated),
    toLodge: num(collectionRemaining(t)),
  };
}

export const cashCollectionsService = {
  async createCollection(associationId: number, userId: number, data: { title: string; meetingId?: number | null; notes?: string | null }) {
    await assertCashEnabled(associationId);

    if (data.meetingId) {
      const meeting = await prisma.meeting.findFirst({ where: { id: data.meetingId, associationId }, select: { id: true } });
      if (!meeting) throw new CashRuleError('INVALID_LINK', 'That meeting was not found for this association.');
    }

    const created = await prisma.cashCollection.create({
      data: { associationId, collectedBy: userId, title: data.title.trim(), meetingId: data.meetingId ?? null, notes: data.notes?.trim() || null },
    });
    await prisma.auditLog.create({
      data: { associationId, userId, action: 'CREATE', tableName: 'cash_collections', recordId: created.id, newValues: { title: created.title, meetingId: created.meetingId } },
    });
    const names = await officerNames([userId]);
    return shapeCollection(created, undefined, names);
  },

  async listCollections(
    associationId: number,
    opts: { userId: number; viewAll: boolean; status?: 'OPEN' | 'CLOSED'; meetingId?: number; page: number; limit: number },
  ) {
    const where: Prisma.CashCollectionWhereInput = {
      associationId,
      ...(opts.viewAll ? {} : { collectedBy: opts.userId }),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.meetingId ? { meetingId: opts.meetingId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cashCollection.findMany({ where, orderBy: { openedAt: 'desc' }, skip: (opts.page - 1) * opts.limit, take: opts.limit }),
      prisma.cashCollection.count({ where }),
    ]);
    const [totals, names] = await Promise.all([collectionTotals(rows.map((r) => r.id)), officerNames(rows.map((r) => r.collectedBy))]);
    return {
      collections: rows.map((r) => shapeCollection(r, totals.get(r.id), names)),
      pagination: { page: opts.page, limit: opts.limit, total, totalPages: Math.max(1, Math.ceil(total / opts.limit)) },
    };
  },

  /** One collection with its receipts. A collector sees their own; officers who can view cash see any. */
  async getCollection(associationId: number, id: number, access: { userId: number; viewAll: boolean }) {
    const collection = await prisma.cashCollection.findFirst({
      where: { id, associationId },
      include: {
        receipts: {
          orderBy: { createdAt: 'desc' },
          include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, items: true },
        },
      },
    });
    if (!collection) throw new CashRuleError('NOT_FOUND', 'That cash collection was not found.');
    if (!access.viewAll && collection.collectedBy !== access.userId) throw new CashRuleError('NOT_FOUND', 'That cash collection was not found.');

    const [totals, names] = await Promise.all([
      collectionTotals([id]),
      officerNames([collection.collectedBy, ...collection.receipts.map((r) => r.createdBy)]),
    ]);
    return {
      ...shapeCollection(collection, totals.get(id), names),
      receipts: collection.receipts.map((r) => shapeReceipt(r, names)),
    };
  },

  /** Closing fixes the collection's receipts so the cash can be counted and lodged. Only the collector closes it. */
  async closeCollection(associationId: number, userId: number, id: number) {
    const collection = await prisma.cashCollection.findFirst({ where: { id, associationId } });
    if (!collection) throw new CashRuleError('NOT_FOUND', 'That cash collection was not found.');
    if (collection.collectedBy !== userId) throw new CashRuleError('NOT_OWNER', 'Only the officer who collected this cash can close it.');

    // Claim-then-act: a second close (double tap, two devices) finds nothing OPEN and changes nothing.
    const claimed = await prisma.cashCollection.updateMany({ where: { id, associationId, status: 'OPEN' }, data: { status: 'CLOSED', closedAt: new Date() } });
    if (claimed.count === 0) throw new CashRuleError('ALREADY_DECIDED', 'This collection is already closed.');

    await prisma.auditLog.create({ data: { associationId, userId, action: 'CLOSE', tableName: 'cash_collections', recordId: id, newValues: {} } });
    return this.getCollection(associationId, id, { userId, viewAll: true });
  },

  /**
   * What a member could pay today, grouped by kind — the Collect cash flow offers exactly these. Nothing here is a new rule: it
   * reads the same balances the member sees in their own screens.
   */
  async getPayables(associationId: number, memberId: number) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, associationId },
      select: { id: true, memberId: true, firstName: true, lastName: true, status: true },
    });
    if (!member) throw new CashRuleError('NOT_FOUND', 'That member was not found.');
    if (member.status === 'terminated') throw new CashRuleError('INVALID_LINK', "That member's membership is disabled.");

    const [charges, savings, loans, funds, categories, allocations] = await Promise.all([
      prisma.transaction.findMany({
        where: { associationId, memberId, isVoided: false, status: { in: ['pending', 'partial', 'overdue'] }, category: { type: { not: 'donation' } } },
        include: { payments: { select: { amountPaid: true } }, category: { select: { name: true, type: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.savingsAccount.findMany({
        where: { associationId, memberId, status: 'ACTIVE' },
        select: { id: true, accountNumber: true, accountType: true, balance: true, monthlyContribution: true },
      }),
      prisma.loan.findMany({
        where: { associationId, memberId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        select: { id: true, loanNumber: true, outstandingBalance: true, nextPaymentAmount: true, nextPaymentDate: true, status: true },
      }),
      prisma.welfareFund.findMany({
        where: { associationId, status: 'ACTIVE' },
        select: { id: true, name: true, minContribution: true, monthlyContribution: true },
        orderBy: { name: 'asc' },
      }),
      prisma.financialCategory.findMany({ where: { associationId, type: 'donation', isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.donationAllocation.findMany({ where: { associationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    return {
      member: { id: member.id, memberId: member.memberId, name: `${member.firstName} ${member.lastName}`.trim() },
      charges: charges
        .map((t) => {
          const paid = t.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          return {
            kind: t.category.type === 'levy' ? ('LEVY' as const) : ('DUES' as const),
            targetId: t.id,
            label: t.category.name,
            dueDate: t.dueDate,
            amount: num(t.amount),
            balance: num(new Decimal(t.amount).minus(paid)),
          };
        })
        .filter((c) => c.balance > 0),
      savings: savings.map((s) => ({
        kind: 'SAVINGS' as const,
        targetId: s.id,
        label: `Savings ${s.accountNumber}`,
        accountType: s.accountType,
        balance: num(s.balance),
        suggested: s.monthlyContribution ? num(s.monthlyContribution) : null,
      })),
      welfare: funds.map((f) => ({
        kind: 'WELFARE' as const,
        targetId: f.id,
        label: f.name,
        minimum: f.minContribution ? num(f.minContribution) : null,
        suggested: f.monthlyContribution ? num(f.monthlyContribution) : null,
      })),
      loans: loans.map((l) => ({
        kind: 'LOAN_REPAYMENT' as const,
        targetId: l.id,
        label: `Loan ${l.loanNumber}`,
        status: l.status,
        outstanding: num(l.outstandingBalance),
        suggested: l.nextPaymentAmount ? num(l.nextPaymentAmount) : null,
        nextPaymentDate: l.nextPaymentDate,
      })),
      donations: { categories, allocations },
    };
  },

  /**
   * Records one member's cash payment inside an open collection. The idempotency key makes a retry (dropped connection,
   * double tap) return the receipt already made instead of crediting the member twice.
   */
  async recordReceipt(
    associationId: number,
    userId: number,
    data: { collectionId: number; memberId: number; idempotencyKey: string; items: CashItemInput[] },
  ): Promise<{ receipt: ReturnType<typeof shapeReceipt>; replayed: boolean }> {
    const names = await officerNames([userId]);

    // Replay first, so a retry works even if the collection has since been closed.
    const existing = await prisma.cashReceipt.findUnique({
      where: { associationId_idempotencyKey: { associationId, idempotencyKey: data.idempotencyKey } },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, items: true },
    });
    if (existing) {
      if (existing.items.length > 0) return { receipt: shapeReceipt(existing, names), replayed: true };
      if (Date.now() - existing.createdAt.getTime() < ABANDONED_AFTER_MS) {
        throw new CashRuleError('ALREADY_DECIDED', 'This receipt is still being saved. Wait a moment and check the collection before trying again.');
      }
      await prisma.cashReceipt.delete({ where: { id: existing.id } }); // abandoned mid-save — start over
    }

    if (data.items.length === 0) throw new CashRuleError('INVALID_ITEM', 'Add at least one payment to the receipt.');
    if (data.items.length > MAX_ITEMS_PER_RECEIPT) throw new CashRuleError('INVALID_ITEM', `A receipt can hold at most ${MAX_ITEMS_PER_RECEIPT} payments.`);
    const seen = new Set<string>();
    for (const item of data.items) {
      const key = `${item.kind}:${item.targetId}`;
      if (seen.has(key)) throw new CashRuleError('INVALID_ITEM', 'The same item is on this receipt twice. Combine them into one amount.');
      seen.add(key);
    }

    const collection = await prisma.cashCollection.findFirst({ where: { id: data.collectionId, associationId } });
    if (!collection) throw new CashRuleError('NOT_FOUND', 'That cash collection was not found.');
    if (collection.collectedBy !== userId) throw new CashRuleError('NOT_OWNER', 'You can only record receipts in a collection you opened.');
    if (collection.status !== 'OPEN') throw new CashRuleError('COLLECTION_CLOSED', 'This collection is closed. Open a new collection to take more cash.');

    await assertCashEnabled(associationId);

    const member = await prisma.member.findFirst({
      where: { id: data.memberId, associationId },
      select: { id: true, memberId: true, firstName: true, lastName: true, status: true, userId: true, email: true },
    });
    if (!member) throw new CashRuleError('INVALID_LINK', 'That member was not found for this association.');
    if (member.status === 'terminated') throw new CashRuleError('INVALID_LINK', "That member's membership is disabled.");

    const total = data.items.reduce((sum, i) => sum.plus(i.amount), new Decimal(0));
    const receiptNumber = `CSH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    // Claim the key first. Two requests with the same key can't both pass this point.
    let claim;
    try {
      claim = await prisma.cashReceipt.create({
        data: { associationId, collectionId: collection.id, memberId: member.id, receiptNumber, idempotencyKey: data.idempotencyKey, totalAmount: total, createdBy: userId },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new CashRuleError('ALREADY_DECIDED', 'This receipt is already being saved. Check the collection before trying again.');
      }
      throw error;
    }

    const done: RecordedItem[] = [];
    try {
      await runAsCashCollection(async () => {
        for (const item of data.items) {
          done.push(await recordCashItem({ associationId, userId, member, receiptNumber }, item));
        }
      });
    } catch (error) {
      if (done.length === 0) {
        await prisma.cashReceipt.delete({ where: { id: claim.id } }).catch(() => undefined);
        throw error;
      }
      // Some payments were already credited — keep them on a receipt (so the cash is accounted for) and say so plainly.
      const kept = done.reduce((sum, i) => sum.plus(i.amount), new Decimal(0));
      await prisma.cashReceipt.update({
        where: { id: claim.id },
        data: { totalAmount: kept, items: { create: done.map((i) => ({ kind: i.kind, sourceId: i.sourceId, label: i.label, amount: i.amount })) } },
      });
      const message = error instanceof Error ? error.message : 'A payment on this receipt could not be saved.';
      throw new CashRuleError('PARTIALLY_RECORDED', `Part of this receipt was saved (₦${kept.toNumber().toLocaleString('en-NG')}), but one payment was not: ${message}`, {
        receiptId: claim.id,
      });
    }

    await prisma.cashReceipt.update({
      where: { id: claim.id },
      data: { items: { create: done.map((i) => ({ kind: i.kind, sourceId: i.sourceId, label: i.label, amount: i.amount })) } },
    });

    await prisma.auditLog.create({
      data: { associationId, userId, action: 'CASH_RECEIPT', tableName: 'cash_receipts', recordId: claim.id, newValues: { receiptNumber, memberId: member.id, total: total.toNumber(), items: done.length } },
    });

    const saved = await prisma.cashReceipt.findUniqueOrThrow({
      where: { id: claim.id },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, items: true },
    });

    void notifyCashReceipt(associationId, { receiptNumber, memberUserId: member.userId, memberName: `${member.firstName} ${member.lastName}`.trim(), receiptId: saved.id, items: done, total: total.toNumber() });
    return { receipt: shapeReceipt(saved, names), replayed: false };
  },
};

export function shapeReceipt(
  r: {
    id: number;
    receiptNumber: string;
    collectionId: number;
    totalAmount: Decimal.Value;
    status: string;
    createdBy: number;
    createdAt: Date;
    voidedAt?: Date | null;
    voidReason?: string | null;
    member: { id: number; memberId: string | null; firstName: string; lastName: string };
    items: Array<{ id: number; kind: string; sourceId: number | null; label: string; amount: Decimal.Value }>;
  },
  names: Map<number, string>,
) {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    collectionId: r.collectionId,
    status: r.status,
    total: num(r.totalAmount),
    createdAt: r.createdAt,
    createdBy: { id: r.createdBy, name: names.get(r.createdBy) ?? 'Unknown officer' },
    voidedAt: r.voidedAt ?? null,
    voidReason: r.voidReason ?? null,
    member: { id: r.member.id, memberId: r.member.memberId, name: `${r.member.firstName} ${r.member.lastName}`.trim() },
    items: r.items.map((i) => ({ id: i.id, kind: i.kind, label: i.label, amount: num(i.amount) })),
  };
}
