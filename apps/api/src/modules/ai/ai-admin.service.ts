/**
 * What the platform owner sees about the AI assistant: what each association's AI use cost (the model's bill, in dollars) against what
 * it paid for extra credits (naira), over a period. Only requests that were answered count toward cost; failed ones were not charged.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';

export type AiUsageRow = {
  associationId: number;
  associationName: string;
  requests: number;
  units: number;
  allowanceUnits: number;
  creditUnits: number;
  costUsd: number;
  creditsSold: number;
  revenueNaira: number;
};

export type AiUsageReport = {
  from: string;
  to: string;
  rows: AiUsageRow[];
  totals: Omit<AiUsageRow, 'associationId' | 'associationName'>;
};

const DAY_MS = 86_400_000;

/** The period asked for: the last `days` days (30 by default, 1 to 365). */
export function usageWindow(days: number | undefined, now = new Date()): { from: Date; to: Date } {
  const span = Math.min(365, Math.max(1, Math.floor(days ?? 30)));
  return { from: new Date(now.getTime() - span * DAY_MS), to: now };
}

export const aiAdminService = {
  async usage(days?: number): Promise<AiUsageReport> {
    const { from, to } = usageWindow(days);

    const [used, sold] = await Promise.all([
      prisma.aIAuditLog.groupBy({
        by: ['associationId'],
        where: { status: 'success', createdAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { units: true, allowanceUnits: true, creditUnits: true, costUsd: true },
      }),
      prisma.aICreditPurchase.groupBy({
        by: ['associationId'],
        where: { status: 'success', paidAt: { gte: from, lte: to } },
        _sum: { credits: true, amount: true },
      }),
    ]);

    const ids = Array.from(new Set([...used.map((u) => u.associationId), ...sold.map((s) => s.associationId)]));
    const names = ids.length > 0 ? await prisma.association.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const nameOf = new Map(names.map((n) => [n.id, n.name]));

    const rows: AiUsageRow[] = ids.map((associationId) => {
      const u = used.find((x) => x.associationId === associationId);
      const s = sold.find((x) => x.associationId === associationId);
      return {
        associationId,
        associationName: nameOf.get(associationId) ?? `Association ${associationId}`,
        requests: u?._count._all ?? 0,
        units: u?._sum.units ?? 0,
        allowanceUnits: u?._sum.allowanceUnits ?? 0,
        creditUnits: u?._sum.creditUnits ?? 0,
        costUsd: new Decimal(u?._sum.costUsd ?? 0).toDecimalPlaces(6).toNumber(),
        creditsSold: s?._sum.credits ?? 0,
        revenueNaira: new Decimal(s?._sum.amount ?? 0).toDecimalPlaces(2).toNumber(),
      };
    });
    rows.sort((a, b) => b.costUsd - a.costUsd || b.revenueNaira - a.revenueNaira);

    const totals = rows.reduce(
      (t, r) => ({
        requests: t.requests + r.requests,
        units: t.units + r.units,
        allowanceUnits: t.allowanceUnits + r.allowanceUnits,
        creditUnits: t.creditUnits + r.creditUnits,
        costUsd: new Decimal(t.costUsd).plus(r.costUsd).toDecimalPlaces(6).toNumber(),
        creditsSold: t.creditsSold + r.creditsSold,
        revenueNaira: new Decimal(t.revenueNaira).plus(r.revenueNaira).toDecimalPlaces(2).toNumber(),
      }),
      { requests: 0, units: 0, allowanceUnits: 0, creditUnits: 0, costUsd: 0, creditsSold: 0, revenueNaira: 0 },
    );

    return { from: from.toISOString(), to: to.toISOString(), rows, totals };
  },
};
