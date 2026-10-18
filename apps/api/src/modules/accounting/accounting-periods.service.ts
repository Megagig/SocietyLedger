import { prisma } from '../../lib/prisma';
import { AccountingPeriodInput, AccountingPeriodResponse, PeriodStatus } from './accounting.types';

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

export const accountingPeriodsService = {
  /**
   * List all accounting periods for an association
   */
  async listPeriods(associationId: number): Promise<AccountingPeriodResponse[]> {
    const periods = await prisma.accountingPeriod.findMany({
      where: { associationId },
      include: { closer: { select: { email: true } } },
      orderBy: { startDate: 'desc' },
    });

    return periods.map(formatPeriodResponse);
  },

  /**
   * Create a new accounting period, rejecting any date range that overlaps an existing one
   */
  async createPeriod(associationId: number, data: AccountingPeriodInput): Promise<AccountingPeriodResponse> {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    const overlapping = await prisma.accountingPeriod.findFirst({
      where: {
        associationId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new Error(`Date range overlaps an existing period: "${overlapping.name}"`);
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        associationId,
        name: data.name,
        periodType: data.periodType,
        startDate,
        endDate,
        status: 'OPEN',
      },
      include: { closer: { select: { email: true } } },
    });

    return formatPeriodResponse(period);
  },

  /**
   * Close an OPEN period. Reversible by reopening.
   */
  async closePeriod(associationId: number, periodId: number, userId: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });

    if (!period) {
      throw new Error('Accounting period not found');
    }

    if (period.status !== 'OPEN') {
      throw new Error('Only an OPEN period can be closed');
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'CLOSED', closedBy: userId, closedAt: new Date() },
      include: { closer: { select: { email: true } } },
    });

    return formatPeriodResponse(updated);
  },

  /**
   * Reopen a CLOSED period. A LOCKED period can never be reopened.
   */
  async reopenPeriod(associationId: number, periodId: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });

    if (!period) {
      throw new Error('Accounting period not found');
    }

    if (period.status !== 'CLOSED') {
      throw new Error('Only a CLOSED period can be reopened');
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN', closedBy: null, closedAt: null },
      include: { closer: { select: { email: true } } },
    });

    return formatPeriodResponse(updated);
  },

  /**
   * Permanently seal a CLOSED period. There is no unlock.
   */
  async lockPeriod(associationId: number, periodId: number, userId: number): Promise<AccountingPeriodResponse> {
    const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, associationId } });

    if (!period) {
      throw new Error('Accounting period not found');
    }

    if (period.status !== 'CLOSED') {
      throw new Error('Only a CLOSED period can be locked — close it first');
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'LOCKED', closedBy: userId, closedAt: new Date() },
      include: { closer: { select: { email: true } } },
    });

    return formatPeriodResponse(updated);
  },

  /**
   * Find the period covering a given date, if any. No period defined for a date
   * means no restriction — periods are opt-in, not a retroactive blanket lock.
   */
  async findPeriodForDate(associationId: number, date: Date): Promise<{ id: number; name: string; status: PeriodStatus } | null> {
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        associationId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (!period) return null;

    return { id: period.id, name: period.name, status: period.status as PeriodStatus };
  },

  /**
   * Throws if the given date falls inside a CLOSED or LOCKED period. Used by callers
   * that must hard-block (manual journal entry create/update).
   */
  async assertDateIsPostable(associationId: number, date: Date): Promise<void> {
    const period = await this.findPeriodForDate(associationId, date);
    if (period && period.status !== 'OPEN') {
      throw new Error(
        `Cannot post to ${date.toISOString().slice(0, 10)} — accounting period "${period.name}" is ${period.status}`
      );
    }
  },
};
