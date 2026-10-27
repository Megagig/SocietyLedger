/**
 * The Ajo contributor limit (T1.2).
 *
 * An "active contributor" is a distinct person (Member) with at least one ACTIVE membership in any of the tenant's Ajo groups. A person in
 * three groups counts once. PENDING, SUSPENDED, LEFT and DEFAULTED memberships are not counted; a defaulted member's debt and history stay
 * in the ledger either way, so leaving the count never erases an obligation.
 *
 * The limit comes from the tenant's entitlements (`ajoContributors`, granted only by the Ajo add-on). The check runs inside the same
 * transaction that activates the membership, behind a per-tenant lock, so two joins at the same moment cannot both slip under the limit.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { computeEntitlements } from '../../services/billing/entitlements.service';

type Tx = Prisma.TransactionClient;

/** Thrown when activating a membership would take the tenant past its Ajo contributor limit. Carries the fields the API sends back. */
export class AjoContributorLimitError extends Error {
  readonly code = 'AJO_CONTRIBUTOR_LIMIT';
  readonly status = 403;
  constructor(readonly limit: number, readonly currentCount: number) {
    super(`Your Ajo plan allows ${limit} active contributors and you have ${currentCount}. Move to a bigger tier to add more.`);
  }
}

/** Distinct people with an ACTIVE membership in the tenant. */
export async function countActiveContributors(associationId: number, db: Pick<Tx, '$queryRaw'> = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT member_id) AS count FROM ajo_memberships WHERE association_id = ${associationId} AND status = 'ACTIVE'`;
  return Number(rows[0]?.count ?? 0);
}

export interface ContributorCapacity {
  /** Null means unlimited. */
  limit: number | null;
  count: number;
}

export async function contributorCapacity(associationId: number): Promise<ContributorCapacity> {
  const [entitlements, count] = await Promise.all([computeEntitlements(associationId), countActiveContributors(associationId)]);
  const limit = entitlements.limits.ajoContributors;
  return { limit: limit === undefined ? null : limit, count };
}

/** Pure: would adding one more distinct contributor pass the limit? */
export function wouldExceedLimit(limit: number | null, count: number, alreadyCounted: boolean): boolean {
  if (alreadyCounted || limit === null) return false;
  return count + 1 > limit;
}

/**
 * Call this inside the transaction that sets a membership to ACTIVE, before the update. It takes a lock for the tenant, so a concurrent
 * activation waits for this one to commit and then counts it. Throws AjoContributorLimitError when the person would be a new contributor
 * past the limit; a person who is already an active contributor in another group never changes the count.
 */
export async function assertContributorCapacity(tx: Tx, associationId: number, memberId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-capacity:' + associationId}))`;

  const [entitlements, count, existing] = await Promise.all([
    computeEntitlements(associationId),
    countActiveContributors(associationId, tx),
    tx.ajoMembership.findFirst({ where: { associationId, memberId, status: 'ACTIVE' }, select: { id: true } }),
  ]);
  const limit = entitlements.limits.ajoContributors ?? null;
  if (wouldExceedLimit(limit, count, existing !== null)) throw new AjoContributorLimitError(limit as number, count);
}
