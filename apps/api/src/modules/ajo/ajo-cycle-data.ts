/**
 * The one small database helper that schedules, payouts and the cycle service all share: a saver's row for a cycle. Kept apart from
 * ajo-cycle.service.ts so the schedule service can use it without a circular import.
 */
import { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

/**
 * A saver's place in a cycle, created if it is not there yet. Older groups have no rows for cycle 1 until something asks, so the first
 * ask creates it at `defaultAmountKobo` (the group's amount), which is what every saver was paying anyway.
 */
export async function ensureCycle(db: Db, membership: { id: number; associationId: number; groupId: number }, cycleNo: number, defaultAmountKobo: bigint) {
  return db.ajoMembershipCycle.upsert({
    where: { membershipId_cycleNo: { membershipId: membership.id, cycleNo } },
    create: { associationId: membership.associationId, groupId: membership.groupId, membershipId: membership.id, cycleNo, amountKobo: defaultAmountKobo },
    update: {},
  });
}
