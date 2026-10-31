/**
 * Which add-on a tenant holds right now, in a product family. Billing owns the add-on tables, so other modules ask here instead of reading
 * them (the Ajo module must never touch the subscription tables directly).
 */
import prisma from '../../lib/prisma';

/** The code of the add-on the tenant currently holds in a family (for example "ajo-growth" in "ajo"), or null if it has none running. */
export async function heldAddonCodeInFamily(associationId: number, family: string, now: Date = new Date()): Promise<string | null> {
  const row = await prisma.tenantAddon.findFirst({
    where: { associationId, status: 'ACTIVE', endsAt: { gt: now }, addonVersion: { addon: { family } } },
    orderBy: { endsAt: 'desc' },
    select: { addonVersion: { select: { addon: { select: { code: true } } } } },
  });
  return row?.addonVersion.addon.code ?? null;
}
