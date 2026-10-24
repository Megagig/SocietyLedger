import { prisma } from '../../lib/prisma';
import { AccountingPeriodInput, AccountingPeriodResponse, PeriodStatus } from './accounting.types';
import { AccountingRuleError, lagosDayEnd, lagosDayKey, lagosDayStart, periodCovers, periodsOverlap } from './accounting-rules';

// ============================================
// ACCOUNTING PERIODS SERVICE
// ============================================

function formatPeriodResponse(period: any): AccountingPeriodResponse {
  return {
    id: period.id,
    name: period.name,
    periodType: period.periodType,
    startDate: period.startDate,
    endDate: period.endDate,
    status: period.status,
    closedBy: period.closedBy,
    closedByEmail: period.closer?.email || null,
    closedAt: period.closedAt,
    createdAt: period.createdAt,
  };
}

const withCloser = { closer: { select: { email: true } } } as const;

async function audit(associationId: number, userId: number, action: string, periodId: number, values: object) {
  await prisma.auditLog.create({ data: { associationId, userId, action, tableName: 'accounting_periods', recordId: periodId, newValues: values } });
}

export const accountingPeriodsService = {
  /**
   * List all accounting periods for an association
   */
  async listPeriods(associationId: number): Promise<AccountingPeriodResponse[]> {
    const periods = await prisma.accountingPeriod.findMany({
      where: { associationId },
      include: withCloser,
      orderBy: { startDate: 'desc' },
    });

    return periods.map(formatPeriodResponse);
  },

  /**
   * Create a new accounting period, rejecting any date range that shares a day with an existing one.
   * A period runs from the first moment of its first day to the last moment of its last day, in Lagos time.
   */
  async createPeriod(associationId: number, data: AccountingPeriodInput, userId?: number): Promise<AccountingPeriodResponse> {
    const startDate = lagosDayStart(lagosDayKey(new Date(data.startDate)));
    const endDate = lagosDayEnd(lagosDayKey(new Date(data.endDate)));
    if (endDate <= startDate) throw new AccountingRuleError('The end date must be after the start date.', 400, 'INVALID_PERIOD');

    const existing = await prisma.accountingPeriod.findMany({ where: { associationId } });
    const overlapping = existing.find((p) => periodsOverlap(p, { startDate, endDate }));
    if (overlapping) {
      throw new AccountingRuleError(`Those dates overlap an existing period: "${overlapping.name}".`, 409, 'PERIOD_OVERLAP');
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        associationId,
        name: data.name.trim(),
        periodType: data.periodType,
        startDate,
        endDate,
        status: 'OPEN',
      },
      include: withCloser,
    });

    if (userId) await audit(associationId, userId, 'PERIOD_CREATED', period.id, { name: period.name, startDate, endDate });
    return formatPeriodResponse(period);
  },

  /**
   * Close an OPEN period. Reversible by reopening. Entries still waiting to be approved or posted inside it would be stranded, so
   * they have to be dealt with first.
   */
  async closePeriod(associationId: number, periodId: number, userId: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });
    if (!period) throw new AccountingRuleError('Accounting period not found.', 404, 'PERIOD_NOT_FOUND');
    if (period.status !== 'OPEN') throw new AccountingRuleError('Only an open period can be closed.', 409, 'WRONG_STATUS');

    const waiting = await prisma.journalEntry.count({
      where: { associationId, status: { in: ['PENDING_APPROVAL', 'APPROVED'] }, entryDate: { gte: period.startDate, lte: period.endDate } },
    });
    if (waiting > 0) {
      throw new AccountingRuleError(
        `${waiting} ${waiting === 1 ? 'entry in this period is' : 'entries in this period are'} still waiting to be approved or posted. Post or reject ${waiting === 1 ? 'it' : 'them'} first.`,
        409,
        'ENTRIES_WAITING',
      );
    }

    const claimed = await prisma.accountingPeriod.updateMany({
      where: { id: periodId, associationId, status: 'OPEN' },
      data: { status: 'CLOSED', closedBy: userId, closedAt: new Date() },
    });
    if (claimed.count === 0) throw new AccountingRuleError('That period was just changed by someone else.', 409, 'WRONG_STATUS');

    await audit(associationId, userId, 'PERIOD_CLOSED', periodId, { name: period.name });
    return formatPeriodResponse(await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId }, include: withCloser }));
  },

  /**
   * Reopen a CLOSED period. A LOCKED period can never be reopened.
   */
  async reopenPeriod(associationId: number, periodId: number, userId?: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });
    if (!period) throw new AccountingRuleError('Accounting period not found.', 404, 'PERIOD_NOT_FOUND');
    if (period.status === 'LOCKED') throw new AccountingRuleError('A locked period can never be reopened.', 409, 'PERIOD_LOCKED');
    if (period.status !== 'CLOSED') throw new AccountingRuleError('Only a closed period can be reopened.', 409, 'WRONG_STATUS');

    const claimed = await prisma.accountingPeriod.updateMany({
      where: { id: periodId, associationId, status: 'CLOSED' },
      data: { status: 'OPEN', closedBy: null, closedAt: null },
    });
    if (claimed.count === 0) throw new AccountingRuleError('That period was just changed by someone else.', 409, 'WRONG_STATUS');

    if (userId) await audit(associationId, userId, 'PERIOD_REOPENED', periodId, { name: period.name });
    return formatPeriodResponse(await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId }, include: withCloser }));
  },

  /**
   * Permanently seal a CLOSED period. There is no unlock.
   */
  async lockPeriod(associationId: number, periodId: number, userId: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });
    if (!period) throw new AccountingRuleError('Accounting period not found.', 404, 'PERIOD_NOT_FOUND');
    if (period.status !== 'CLOSED') throw new AccountingRuleError('Close the period first. Only a closed period can be locked.', 409, 'WRONG_STATUS');

    const claimed = await prisma.accountingPeriod.updateMany({
      where: { id: periodId, associationId, status: 'CLOSED' },
      data: { status: 'LOCKED', closedBy: userId, closedAt: new Date() },
    });
    if (claimed.count === 0) throw new AccountingRuleError('That period was just changed by someone else.', 409, 'WRONG_STATUS');

    await audit(associationId, userId, 'PERIOD_LOCKED', periodId, { name: period.name });
    return formatPeriodResponse(await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId }, include: withCloser }));
  },

  /**
   * Find the period covering a given date, if any. No period defined for a date
   * means no restriction — periods are opt-in, not a retroactive blanket lock.
   */
  async findPeriodForDate(associationId: number, date: Date): Promise<{ id: number; name: string; status: PeriodStatus } | null> {
    const periods = await prisma.accountingPeriod.findMany({ where: { associationId } });
    const period = periods.find((p) => periodCovers(p, date));
    return period ? { id: period.id, name: period.name, status: period.status as PeriodStatus } : null;
  },

  /**
   * Throws if the given date falls inside a CLOSED or LOCKED period. Used by callers
   * that must hard-block (manual journal entry create/update, and posting).
   */
  async assertDateIsPostable(associationId: number, date: Date): Promise<void> {
    const period = await this.findPeriodForDate(associationId, date);
    if (period && period.status !== 'OPEN') {
      throw new AccountingRuleError(
        `The period "${period.name}" is ${period.status === 'LOCKED' ? 'locked' : 'closed'}, so nothing can be posted to ${date.toISOString().slice(0, 10)}.`,
        409,
        'PERIOD_CLOSED',
      );
    }
  },
};
