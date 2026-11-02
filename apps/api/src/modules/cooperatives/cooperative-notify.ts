import { prisma } from '../../lib/prisma';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { cooperativesService } from './cooperatives.service';

/** Tell the member (in-app + push) what happened to something they submitted. Best effort: never throws, never fails the decision. */
export async function notifyMember(
  associationId: number,
  memberId: number,
  alert: { title: string; message: string; entityId: number; pushType: string },
): Promise<void> {
  try {
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } });
    if (!member?.userId) return;
    await dispatchNotification({
      associationId,
      userId: member.userId,
      kind: 'system',
      entityId: alert.entityId,
      pushType: alert.pushType,
      title: alert.title,
      message: alert.message,
    });
  } catch (error) {
    console.error('Member notification failed (non-critical):', error);
  }
}

/** Tell every officer who holds one of the permissions (never the member themselves). Best effort. */
export function notifyOfficers(
  associationId: number,
  permissionKeys: string[],
  alert: { memberId: number; title: string; what: (memberName: string) => string; entityId: number; pushType: string },
): Promise<void> {
  return cooperativesService.notifyApprovers(associationId, permissionKeys, alert);
}

export const naira = (value: number | string | { toString(): string }) =>
  `₦${Number(value.toString()).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
