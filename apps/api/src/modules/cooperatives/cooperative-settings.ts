import { prisma } from '../../lib/prisma';

const TWO_STAGE_KEY = 'cooperative.withdrawals.two_stage';

/**
 * Whether withdrawals need a separate review stage before final approval. On unless the association has switched it off, so a society that
 * never opens the setting gets the safer behaviour. Stored in the association's own key/value settings.
 */
export async function getTwoStageWithdrawal(associationId: number): Promise<boolean> {
  const row = await prisma.settings.findFirst({ where: { associationId, key: TWO_STAGE_KEY }, select: { value: true } });
  return row?.value !== 'false';
}

export async function setTwoStageWithdrawal(associationId: number, userId: number, enabled: boolean): Promise<boolean> {
  const value = enabled ? 'true' : 'false';
  const existing = await prisma.settings.findFirst({ where: { associationId, key: TWO_STAGE_KEY }, select: { id: true } });
  if (existing) {
    await prisma.settings.update({ where: { id: existing.id }, data: { value, updatedBy: userId } });
  } else {
    await prisma.settings.create({
      data: {
        associationId,
        key: TWO_STAGE_KEY,
        value,
        description: 'Whether a member withdrawal needs a separate review before final approval',
        updatedBy: userId,
      },
    });
  }
  return enabled;
}
