/**
 * Add-on analytics for SocietyLedger staff (T9.3): who has adopted Ajo, how many people really contribute, and what it earns us.
 *
 *  - Adoption: tenants holding each Ajo tier now, and how many circles exist.
 *  - Active contributors: distinct people with a confirmed contribution (not since reversed) in the last 30 days. Contribution money is
 *    only counted as a head count; it is never SocietyLedger revenue.
 *  - Revenue: the recurring subscription of paying groups (annual spread over 12 months) plus the platform levy. Money is whole kobo.
 */
import prisma from '../../lib/prisma';
import { tierAdoption, tierRevenueByMonth } from '../../services/billing/tier-change.service';
import { levyReport } from './ajo-levy.service';
import { AJO_FAMILY } from './ajo-oversight.service';

const DAY = 24 * 60 * 60 * 1000;
export const ACTIVE_WINDOW_DAYS = 30;
export const SERIES_MONTHS = 6;

/** "2026-10" for a date, in UTC. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The last `count` month keys ending at `now`, oldest first. */
export function lastMonths(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1))));
}

export async function ajoAnalytics(now: Date = new Date()) {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY);
  const seriesFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (SERIES_MONTHS - 1), 1));

  const [tiers, groupsByStatus, groupsByModel, owners, active, activeBefore, levy, levyRows, paidByMonth] = await Promise.all([
    tierAdoption(AJO_FAMILY, now),
    prisma.ajoGroup.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ajoGroup.groupBy({ by: ['model'], _count: { _all: true } }),
    prisma.ajoGroup.findMany({ distinct: ['associationId'], select: { association: { select: { kind: true } } } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT m.member_id) AS count
      FROM ajo_contributions c JOIN ajo_memberships m ON m.id = c.membership_id
      WHERE c.status = 'CONFIRMED' AND c.confirmed_at >= ${since}
        AND NOT EXISTS (SELECT 1 FROM ajo_contributions r WHERE r.reversal_of_id = c.id)`,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT m.member_id) AS count
      FROM ajo_contributions c JOIN ajo_memberships m ON m.id = c.membership_id
      WHERE c.status = 'CONFIRMED' AND c.confirmed_at >= ${new Date(since.getTime() - ACTIVE_WINDOW_DAYS * DAY)} AND c.confirmed_at < ${since}
        AND NOT EXISTS (SELECT 1 FROM ajo_contributions r WHERE r.reversal_of_id = c.id)`,
    levyReport(),
    prisma.ajoLevyAssessment.findMany({ where: { accruedAt: { gte: seriesFrom }, status: { in: ['ACCRUED', 'BILLED', 'PAID'] } }, select: { accruedAt: true, amountKobo: true } }),
    tierRevenueByMonth(AJO_FAMILY, seriesFrom),
  ]);

  const months = lastMonths(now, SERIES_MONTHS);
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const r of levyRows) {
    const k = monthKey(r.accruedAt);
    if (byMonth.has(k)) byMonth.set(k, (byMonth.get(k) ?? 0) + Number(r.amountKobo));
  }

  const kobo = (status: string) => Number(levy.totals[status]?.kobo ?? 0);
  const subscriptionMonthlyKobo = tiers.reduce((sum, t) => sum + t.monthlyRecurringKobo, 0);
  return {
    asOf: now.toISOString(),
    adoption: {
      tiers,
      holders: tiers.reduce((s, t) => s + t.holders, 0),
      paying: tiers.reduce((s, t) => s + t.paying, 0),
      owners: { associations: owners.filter((o) => o.association.kind === 'ASSOCIATION').length, standalone: owners.filter((o) => o.association.kind === 'THRIFT_GROUP').length },
      groups: {
        byStatus: Object.fromEntries(groupsByStatus.map((g) => [g.status, g._count._all])),
        byModel: Object.fromEntries(groupsByModel.map((g) => [g.model, g._count._all])),
      },
    },
    contributors: { windowDays: ACTIVE_WINDOW_DAYS, active: Number(active[0]?.count ?? 0), previousWindow: Number(activeBefore[0]?.count ?? 0) },
    revenue: {
      subscriptionMonthlyKobo,
      levy: { accruedKobo: kobo('ACCRUED'), billedKobo: kobo('BILLED'), paidKobo: kobo('PAID'), waivedKobo: kobo('WAIVED') },
      levySeries: months.map((m) => ({ month: m, kobo: byMonth.get(m) ?? 0 })),
      /** What groups paid for their tiers each month, from the payments themselves (net of credit for a replaced tier). */
      tierPaymentsSeries: months.map((m) => ({ month: m, kobo: paidByMonth.get(m) ?? 0 })),
      /** The monthly subscription of the average paying group. */
      averagePerPayingGroupKobo: tiers.reduce((s, t) => s + t.paying, 0) > 0 ? Math.round(subscriptionMonthlyKobo / tiers.reduce((s, t) => s + t.paying, 0)) : 0,
    },
  };
}
