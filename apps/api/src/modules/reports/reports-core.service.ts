import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { isOverdue } from '../finance/overdue-rules';
import type {
  AgingAnalysisReport,
  AgingBucket,
  CategoryReport,
  CollectionRateReport,
  DateRangeFilter,
  FinancialSummaryReport,
  MemberBalanceReport,
} from './reports.types';
import {
  AGING_BUCKETS,
  agingBucketOf,
  agingWhere,
  COUNTED_CHARGE,
  daysOverdue,
  groupKey,
  groupLabel,
  groupRange,
  OWING_CHARGE,
  periodRange,
  previousRange,
  type AgingBucketKey,
  type GroupBy,
  type ReportPeriod,
} from './report-rules';
import { RuleError } from '../finance/rule-error';

/**
 * The reports an officer reads, and the lists behind every figure on them. Both are worked out from the same filters
 * (`chargeWhere`, `paymentWhere`), so tapping a figure shows the records that add up to it.
 *
 * What counts: money the association expects is a charge that is not voided and not waived. Money received is every payment dated in
 * the period, whatever charge it was for. A report is never cached, so it always agrees with the lists behind it.
 */

const ZERO = new Decimal(0);
const sum = (values: Decimal.Value[]): Decimal => values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);

export function resolveRange(filter: DateRangeFilter) {
  const period: ReportPeriod = filter.period ?? (filter.startDate && filter.endDate ? 'custom' : 'this_month');
  return periodRange(period, { startDate: filter.startDate, endDate: filter.endDate });
}

// ---------------------------------------------------------------- filters shared by the reports and their lists

export type ChargeFilter = {
  /** raised: charges created in the range · owing: still owing something · overdue: owing and past due · aging: a bucket of the owing ones */
  scope: 'raised' | 'owing' | 'overdue' | 'aging';
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  categoryType?: string;
  memberId?: number;
  bucket?: AgingBucketKey;
  asOf?: Date;
  /** For a category's status split: paid, partial, pending, overdue or waived. */
  status?: 'paid' | 'partial' | 'pending' | 'overdue' | 'waived';
  /** With scope raised: only the raised charges that still owe something (the figure "still owed" on a period). */
  owingOnly?: boolean;
};

export function chargeWhere(associationId: number, f: ChargeFilter, now: Date = new Date()) {
  const where: Record<string, unknown> = { associationId };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.categoryType) where.category = { type: f.categoryType };
  if (f.memberId) where.memberId = f.memberId;

  if (f.status === 'waived') {
    Object.assign(where, { isVoided: false, status: 'waived' });
  } else if (f.scope === 'raised') {
    Object.assign(where, COUNTED_CHARGE);
  } else {
    Object.assign(where, OWING_CHARGE);
  }

  // What members still owe is what is chased, so a member who was disabled is left out of every "owing" figure and list
  if (f.scope !== 'raised' || f.owingOnly) where.member = { status: { not: 'terminated' } };
  if (f.scope === 'raised' && f.owingOnly) Object.assign(where, OWING_CHARGE);
  if (f.scope === 'raised' && f.startDate && f.endDate) where.createdAt = { gte: f.startDate, lte: f.endDate };
  if (f.scope === 'overdue') where.dueDate = { lt: f.asOf ?? now };
  if (f.scope === 'aging') {
    if (!f.bucket) throw new RuleError('Choose an aging bucket.', 400, 'BUCKET_REQUIRED');
    Object.assign(where, agingWhere(f.bucket, f.asOf ?? now));
  }
  if (f.status && f.status !== 'waived' && f.status !== 'overdue') where.status = f.status === 'pending' ? { in: ['pending', 'overdue'] } : f.status;
  return where;
}

export type PaymentFilter = { startDate?: Date; endDate?: Date; categoryId?: number; categoryType?: string; memberId?: number; /** A payment method, or 'unspecified' for payments recorded without one. */ paymentMethod?: string };

export function paymentWhere(associationId: number, f: PaymentFilter) {
  const where: Record<string, unknown> = { associationId };
  if (f.startDate && f.endDate) where.paymentDate = { gte: f.startDate, lte: f.endDate };
  if (f.paymentMethod) where.paymentMethod = f.paymentMethod === 'unspecified' ? null : f.paymentMethod;
  const charge: Record<string, unknown> = {};
  if (f.categoryId) charge.categoryId = f.categoryId;
  if (f.categoryType) charge.category = { type: f.categoryType };
  if (f.memberId) charge.memberId = f.memberId;
  if (Object.keys(charge).length > 0) where.transaction = charge;
  return where;
}

// ---------------------------------------------------------------- the effective state of one charge

type ChargeRow = {
  id: number;
  amount: Decimal;
  status: string;
  dueDate: Date | null;
  isVoided: boolean;
  payments: Array<{ amountPaid: Decimal }>;
};

const paidOf = (c: Pick<ChargeRow, 'payments'>): Decimal => sum(c.payments.map((p) => p.amountPaid));

/** What a charge is, as the reader sees it: an open charge past its due date is overdue whatever the stored status says. */
export function effectiveStatus(c: Pick<ChargeRow, 'status' | 'dueDate' | 'isVoided'>, now: Date): string {
  if (c.isVoided) return 'voided';
  return isOverdue({ isVoided: false, status: c.status, dueDate: c.dueDate }, now) ? 'overdue' : c.status === 'overdue' ? 'pending' : c.status;
}

// ---------------------------------------------------------------- 1. financial summary

export async function generateFinancialSummary(associationId: number, filter: DateRangeFilter, includeComparison = false): Promise<FinancialSummaryReport> {
  const { startDate, endDate, label } = resolveRange(filter);

  const received = await receivedIn(associationId, startDate, endDate);
  const cohort = await cohortOf(associationId, startDate, endDate);

  const report: FinancialSummaryReport = {
    period: { startDate, endDate, label },
    // Income is the money that came in during the period. Penalties are money members paid too, so they are income, not expenses:
    // this report has no source for the association's own spending (that lives in Accounting), so expenses are shown as nothing.
    income: { total: received.total, byCategory: received.byCategory },
    expenses: { total: ZERO, byCategory: [] },
    collections: { expected: cohort.expected, collected: cohort.collected, outstanding: cohort.expected.minus(cohort.collected), collectionRate: cohort.rate },
    received: { total: received.total, paymentCount: received.paymentCount },
    raised: { total: cohort.expected, chargeCount: cohort.chargeCount },
  };

  if (includeComparison) {
    const prev = previousRange({ startDate, endDate });
    const prevReceived = await receivedIn(associationId, prev.startDate, prev.endDate);
    const prevCohort = await cohortOf(associationId, prev.startDate, prev.endDate);
    const change = (current: Decimal, before: Decimal) => ({
      amount: current.minus(before),
      percentage: before.isZero() ? (current.isZero() ? 0 : 100) : current.minus(before).dividedBy(before).times(100).toNumber(),
    });
    report.comparison = {
      previousPeriod: { startDate: prev.startDate, endDate: prev.endDate, income: prevReceived.total, expenses: ZERO, collections: prevCohort.collected },
      changes: { income: change(received.total, prevReceived.total), expenses: change(ZERO, ZERO), collections: change(cohort.collected, prevCohort.collected) },
    };
  }
  return report;
}

async function receivedIn(associationId: number, startDate: Date, endDate: Date) {
  const payments = await prisma.payment.findMany({
    where: paymentWhere(associationId, { startDate, endDate }) as never,
    select: { amountPaid: true, transaction: { select: { category: { select: { id: true, name: true, type: true } } } } },
  });
  const byCategory = new Map<number, { categoryId: number; categoryName: string; categoryType: string; amount: Decimal; transactionCount: number }>();
  for (const p of payments) {
    const c = p.transaction.category;
    const row = byCategory.get(c.id) ?? { categoryId: c.id, categoryName: c.name, categoryType: c.type, amount: ZERO, transactionCount: 0 };
    row.amount = row.amount.plus(p.amountPaid);
    row.transactionCount += 1;
    byCategory.set(c.id, row);
  }
  return { total: sum(payments.map((p) => p.amountPaid)), paymentCount: payments.length, byCategory: [...byCategory.values()].sort((a, b) => b.amount.comparedTo(a.amount)) };
}

/** The charges raised in a period, and how much of them has been paid so far (whenever it was paid). */
async function cohortOf(associationId: number, startDate: Date, endDate: Date) {
  const charges = await prisma.transaction.findMany({
    where: chargeWhere(associationId, { scope: 'raised', startDate, endDate }) as never,
    select: { amount: true, payments: { select: { amountPaid: true } } },
  });
  const expected = sum(charges.map((c) => c.amount));
  const collected = sum(charges.flatMap((c) => c.payments.map((p) => p.amountPaid)));
  return { expected, collected, chargeCount: charges.length, rate: expected.isZero() ? 0 : collected.dividedBy(expected).times(100).toNumber() };
}

// ---------------------------------------------------------------- 2. member balances

export async function generateMemberBalances(
  associationId: number,
  options: { page?: number; limit?: number; status?: 'all' | 'with_balance' | 'overdue'; search?: string; sortBy?: 'name' | 'balance' | 'lastPayment'; sortOrder?: 'asc' | 'desc' } = {},
  now: Date = new Date(),
): Promise<{ members: MemberBalanceReport[]; pagination: unknown; totals: { memberCount: number; totalDues: Decimal; totalPaid: Decimal; balance: Decimal; overdueCharges: number } }> {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  // Members who left (disabled) are not chased; inactive and suspended members still owe what they owe
  const where: Record<string, unknown> = { associationId, status: { not: 'terminated' } };
  if (options.search) {
    where.OR = [
      { firstName: { contains: options.search, mode: 'insensitive' } },
      { lastName: { contains: options.search, mode: 'insensitive' } },
      { memberId: { contains: options.search, mode: 'insensitive' } },
      { email: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const members = await prisma.member.findMany({
    where: where as never,
    select: {
      id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true, status: true,
      transactions: {
        where: COUNTED_CHARGE as never,
        select: { amount: true, status: true, dueDate: true, isVoided: true, payments: { select: { amountPaid: true, paymentDate: true } } },
      },
    },
  });

  const all: MemberBalanceReport[] = members.map((m) => {
    let totalDues = ZERO;
    let totalPaid = ZERO;
    let pending = 0;
    let overdue = 0;
    let lastPaymentDate: Date | null = null;
    for (const t of m.transactions) {
      totalDues = totalDues.plus(t.amount);
      const paid = sum(t.payments.map((p) => p.amountPaid));
      totalPaid = totalPaid.plus(paid);
      if (['pending', 'partial', 'overdue'].includes(t.status) && new Decimal(t.amount).minus(paid).greaterThan(0)) {
        if (isOverdue(t, now)) overdue += 1;
        else pending += 1;
      }
      for (const p of t.payments) if (!lastPaymentDate || p.paymentDate > lastPaymentDate) lastPaymentDate = p.paymentDate;
    }
    return {
      memberId: m.id, memberNumber: m.memberId, firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone,
      totalDues, totalPaid, balance: totalDues.minus(totalPaid), pendingTransactions: pending, overdueTransactions: overdue, lastPaymentDate, status: m.status,
    };
  });

  let filtered = all;
  if (options.status === 'with_balance') filtered = all.filter((m) => m.balance.greaterThan(0));
  else if (options.status === 'overdue') filtered = all.filter((m) => m.overdueTransactions > 0);

  const sortBy = options.sortBy || 'balance';
  const sign = (options.sortOrder || 'desc') === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    let c = 0;
    if (sortBy === 'name') c = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    else if (sortBy === 'balance') c = a.balance.comparedTo(b.balance);
    else c = (a.lastPaymentDate?.getTime() || 0) - (b.lastPaymentDate?.getTime() || 0);
    return sign * c;
  });

  const pageRows = filtered.slice(skip, skip + limit);
  return {
    members: pageRows,
    pagination: { page, limit, totalCount: filtered.length, totalPages: Math.ceil(filtered.length / limit), hasMore: skip + pageRows.length < filtered.length },
    // Over the whole filtered list, not just this page: what the figures at the top of the screen add up
    totals: {
      memberCount: filtered.length,
      totalDues: sum(filtered.map((m) => m.totalDues)),
      totalPaid: sum(filtered.map((m) => m.totalPaid)),
      balance: sum(filtered.map((m) => m.balance)),
      overdueCharges: filtered.reduce((n, m) => n + m.overdueTransactions, 0),
    },
  };
}

// ---------------------------------------------------------------- 3. aging

export async function generateAgingAnalysis(associationId: number, asOfDate?: Date, includeDetails = true): Promise<AgingAnalysisReport> {
  const asOf = asOfDate ?? new Date();
  const charges = await prisma.transaction.findMany({
    where: chargeWhere(associationId, { scope: 'owing' }) as never,
    select: { id: true, amount: true, dueDate: true, memberId: true, member: { select: { id: true, firstName: true, lastName: true } }, payments: { select: { amountPaid: true } } },
  });

  const buckets = Object.fromEntries(
    AGING_BUCKETS.map((b) => [b.key, { range: b.range, minDays: b.minDays, maxDays: b.maxDays, count: 0, amount: ZERO, members: [] } as AgingBucket]),
  ) as Record<AgingBucketKey, AgingBucket>;

  let total = ZERO;
  let counted = 0;
  const allMembers = new Set<number>();
  // member totals per bucket, so a bucket's amount is exactly the sum of its members
  const perBucketMember = new Map<string, { bucket: AgingBucketKey; memberId: number; name: string; amount: Decimal; chargeCount: number; oldest: Date; days: number }>();

  for (const c of charges) {
    const balance = new Decimal(c.amount).minus(sum(c.payments.map((p) => p.amountPaid)));
    if (balance.lessThanOrEqualTo(0)) continue;
    const key = agingBucketOf(c.dueDate, asOf);
    const bucket = buckets[key];
    bucket.count += 1;
    bucket.amount = bucket.amount.plus(balance);
    total = total.plus(balance);
    counted += 1;
    allMembers.add(c.memberId);

    if (includeDetails) {
      const id = `${key}:${c.memberId}`;
      const days = daysOverdue(c.dueDate, asOf);
      const row = perBucketMember.get(id) ?? { bucket: key, memberId: c.memberId, name: `${c.member.firstName} ${c.member.lastName}`, amount: ZERO, chargeCount: 0, oldest: c.dueDate ?? asOf, days: 0 };
      row.amount = row.amount.plus(balance);
      row.chargeCount += 1;
      if (days >= row.days) {
        row.days = days;
        row.oldest = c.dueDate ?? row.oldest;
      }
      perBucketMember.set(id, row);
    }
  }

  for (const r of perBucketMember.values()) {
    buckets[r.bucket].members.push({ memberId: r.memberId, memberName: r.name, amount: r.amount, oldestDueDate: r.oldest, daysOverdue: r.days, chargeCount: r.chargeCount });
  }
  for (const b of Object.values(buckets)) b.members.sort((a, c) => c.amount.comparedTo(a.amount));

  return {
    asOfDate: asOf,
    summary: { totalOutstanding: total, totalMembers: allMembers.size, totalTransactions: counted },
    buckets: { notYetDue: buckets.notYetDue, current: buckets.current, days31to60: buckets.days31to60, days61to90: buckets.days61to90, over90: buckets.over90 },
  };
}

// ---------------------------------------------------------------- 4. collection rate

export async function generateCollectionRate(associationId: number, filter: DateRangeFilter, groupBy: GroupBy = 'month'): Promise<CollectionRateReport> {
  const { startDate, endDate, label } = resolveRange(filter);
  const charges = await prisma.transaction.findMany({
    where: chargeWhere(associationId, { scope: 'raised', startDate, endDate }) as never,
    select: { amount: true, createdAt: true, category: { select: { id: true, name: true, type: true } }, payments: { select: { amountPaid: true } } },
  });

  let expected = ZERO;
  let collected = ZERO;
  const byGroup = new Map<string, { expected: Decimal; collected: Decimal }>();
  const byCategory = new Map<number, { name: string; type: string; expected: Decimal; collected: Decimal }>();
  for (const c of charges) {
    const paid = sum(c.payments.map((p) => p.amountPaid));
    expected = expected.plus(c.amount);
    collected = collected.plus(paid);
    const key = groupKey(c.createdAt, groupBy);
    const g = byGroup.get(key) ?? { expected: ZERO, collected: ZERO };
    g.expected = g.expected.plus(c.amount);
    g.collected = g.collected.plus(paid);
    byGroup.set(key, g);
    const cat = byCategory.get(c.category.id) ?? { name: c.category.name, type: c.category.type, expected: ZERO, collected: ZERO };
    cat.expected = cat.expected.plus(c.amount);
    cat.collected = cat.collected.plus(paid);
    byCategory.set(c.category.id, cat);
  }

  const rate = (e: Decimal, c: Decimal) => (e.isZero() ? 0 : c.dividedBy(e).times(100).toNumber());
  return {
    period: { startDate, endDate, label },
    overall: { expected, collected, outstanding: expected.minus(collected), collectionRate: rate(expected, collected) },
    byMonth: [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, g]) => {
        const range = groupRange(key, groupBy);
        return {
          key,
          month: groupLabel(key, groupBy),
          year: Number(key.slice(0, 4)),
          startDate: range.startDate,
          endDate: range.endDate,
          expected: g.expected,
          collected: g.collected,
          collectionRate: rate(g.expected, g.collected),
        };
      }),
    byCategory: [...byCategory.entries()].map(([id, c]) => ({
      categoryId: id, categoryName: c.name, categoryType: c.type, expected: c.expected, collected: c.collected, collectionRate: rate(c.expected, c.collected),
    })),
  };
}

// ---------------------------------------------------------------- 5. by category

export async function generateCategoryReport(
  associationId: number,
  options: { categoryId?: number; type?: string; startDate?: Date; endDate?: Date; includeTransactions?: boolean; transactionLimit?: number } = {},
  now: Date = new Date(),
): Promise<CategoryReport[]> {
  const categories = await prisma.financialCategory.findMany({
    where: { associationId, ...(options.categoryId ? { id: options.categoryId } : {}), ...(options.type ? { type: options.type } : {}) },
    orderBy: { name: 'asc' },
  });
  const range = options.startDate && options.endDate ? { createdAt: { gte: options.startDate, lte: options.endDate } } : {};

  return Promise.all(
    categories.map(async (category) => {
      // Every charge of the category in the range that is not voided (forgiven ones are shown on their own line, not counted as owed)
      const charges = await prisma.transaction.findMany({
        where: { associationId, categoryId: category.id, isVoided: false, ...range },
        select: { id: true, referenceNumber: true, amount: true, status: true, dueDate: true, isVoided: true, memberId: true, createdAt: true, member: { select: { firstName: true, lastName: true } }, payments: { select: { amountPaid: true } } },
        orderBy: { createdAt: 'desc' },
      });

      let expected = ZERO;
      let collected = ZERO;
      const members = new Set<number>();
      const byStatus: Record<string, { count: number; amount: Decimal }> = {
        pending: { count: 0, amount: ZERO }, paid: { count: 0, amount: ZERO }, overdue: { count: 0, amount: ZERO }, partial: { count: 0, amount: ZERO }, waived: { count: 0, amount: ZERO },
      };
      let counted = 0;
      for (const c of charges) {
        const bucket = byStatus[effectiveStatus(c, now)];
        if (bucket) {
          bucket.count += 1;
          bucket.amount = bucket.amount.plus(c.amount);
        }
        if (c.status === 'waived') continue;
        counted += 1;
        expected = expected.plus(c.amount);
        collected = collected.plus(paidOf(c));
        members.add(c.memberId);
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        isActive: category.isActive,
        statistics: {
          totalExpected: expected,
          totalCollected: collected,
          totalOutstanding: expected.minus(collected),
          collectionRate: expected.isZero() ? 0 : collected.dividedBy(expected).times(100).toNumber(),
          transactionCount: counted,
          memberCount: members.size,
        },
        byStatus,
        recentTransactions: options.includeTransactions
          ? charges.slice(0, options.transactionLimit || 10).map((c) => {
              const paid = paidOf(c);
              return {
                id: c.id, referenceNumber: c.referenceNumber || '', memberName: `${c.member.firstName} ${c.member.lastName}`, amount: c.amount, paidAmount: paid,
                balance: new Decimal(c.amount).minus(paid), status: effectiveStatus(c, now), dueDate: c.dueDate, createdAt: c.createdAt,
              };
            })
          : [],
      };
    }),
  );
}

// ---------------------------------------------------------------- the lists behind the figures

const MAX_ROWS = 20_000;

export async function listCharges(associationId: number, filter: ChargeFilter, page = 1, limit = 25, now: Date = new Date()) {
  const rows = await prisma.transaction.findMany({
    where: chargeWhere(associationId, filter, now) as never,
    select: {
      id: true, referenceNumber: true, amount: true, status: true, dueDate: true, createdAt: true, isVoided: true,
      member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
      category: { select: { id: true, name: true, type: true } },
      payments: { select: { amountPaid: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    take: MAX_ROWS,
  });

  let items = rows.map((c) => {
    const paid = paidOf(c);
    return {
      id: c.id,
      referenceNumber: c.referenceNumber,
      memberId: c.member.id,
      memberNumber: c.member.memberId,
      memberName: `${c.member.firstName} ${c.member.lastName}`,
      categoryId: c.category.id,
      categoryName: c.category.name,
      categoryType: c.category.type,
      amount: new Decimal(c.amount),
      paid,
      balance: new Decimal(c.amount).minus(paid),
      status: effectiveStatus(c, now),
      dueDate: c.dueDate,
      createdAt: c.createdAt,
    };
  });
  // "Owing" lists hold only charges with something left to pay, the same as the figures they explain
  if (filter.scope !== 'raised' || filter.owingOnly) items = items.filter((i) => i.balance.greaterThan(0));
  if (filter.status === 'overdue') items = items.filter((i) => i.status === 'overdue');
  if (filter.status === 'pending') items = items.filter((i) => i.status === 'pending');

  const totals = { count: items.length, amount: sum(items.map((i) => i.amount)), paid: sum(items.map((i) => i.paid)), balance: sum(items.map((i) => i.balance)) };
  const skip = (page - 1) * limit;
  return {
    charges: items.slice(skip, skip + limit),
    totals,
    pagination: { page, limit, totalCount: items.length, totalPages: Math.ceil(items.length / limit), hasMore: skip + limit < items.length },
  };
}

export async function listPayments(associationId: number, filter: PaymentFilter, page = 1, limit = 25) {
  const where = paymentWhere(associationId, filter) as never;
  const [rows, aggregate, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, amountPaid: true, paymentDate: true, paymentMethod: true, receiptNumber: true, transactionId: true,
        transaction: { select: { referenceNumber: true, isVoided: true, member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, category: { select: { id: true, name: true, type: true } } } },
      },
    }),
    prisma.payment.aggregate({ where, _sum: { amountPaid: true }, _count: true }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: rows.map((p) => ({
      id: p.id,
      amountPaid: p.amountPaid,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      receiptNumber: p.receiptNumber,
      chargeId: p.transactionId,
      chargeReference: p.transaction.referenceNumber,
      chargeVoided: p.transaction.isVoided,
      memberId: p.transaction.member.id,
      memberNumber: p.transaction.member.memberId,
      memberName: `${p.transaction.member.firstName} ${p.transaction.member.lastName}`,
      categoryId: p.transaction.category.id,
      categoryName: p.transaction.category.name,
      categoryType: p.transaction.category.type,
    })),
    totals: { count: aggregate._count, amount: aggregate._sum.amountPaid ?? ZERO },
    pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit), hasMore: page * limit < totalCount },
  };
}
