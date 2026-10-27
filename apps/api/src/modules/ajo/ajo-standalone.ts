/**
 * Standalone thrift groups (T1.3): an outsider's Ajo group registered as its own tenant (`Association.kind = THRIFT_GROUP`).
 *
 * It is billed the same way as every other tenant, through a subscription: a hidden-from-associations base plan (`thrift-group`, core
 * modules only, no price) plus one of the Ajo tiers. The trial is a 14-day complimentary Ajo Starter add-on that starts with the
 * subscription's trial. The only places that know the kind are the signup route, the entitlements restriction and the plan catalogue
 * audience; nothing else branches on it.
 */
import prisma from '../../lib/prisma';

export const THRIFT_GROUP_PLAN_CODE = 'thrift-group';
export const TRIAL_ADDON_CODE = 'ajo-starter';

/**
 * Give a standalone group's trial the Ajo Starter add-on, ending when the trial ends. Safe to call twice (it will not add a second row),
 * and does nothing for an ordinary association.
 */
export async function grantThriftTrialAddon(associationId: number, endsAt: Date, now = new Date()): Promise<boolean> {
  const association = await prisma.association.findUnique({ where: { id: associationId }, select: { kind: true } });
  if (association?.kind !== 'THRIFT_GROUP') return false;

  const subscription = await prisma.subscription.findFirst({ where: { associationId }, orderBy: { id: 'desc' }, select: { id: true } });
  const version = await prisma.addonVersion.findFirst({
    where: { addon: { code: TRIAL_ADDON_CODE }, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!subscription || !version) return false;

  const held = await prisma.tenantAddon.findFirst({ where: { subscriptionId: subscription.id, addonVersion: { addon: { code: TRIAL_ADDON_CODE } }, status: 'ACTIVE' }, select: { id: true } });
  if (held) return false;

  await prisma.tenantAddon.create({
    data: {
      associationId,
      subscriptionId: subscription.id,
      addonVersionId: version.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      startsAt: now,
      endsAt,
      source: 'COMPLIMENTARY',
      amountPaidKobo: 0,
      reason: 'Ajo trial at the Starter limit',
    },
  });
  return true;
}
