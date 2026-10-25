import { prisma } from '../lib/prisma';
import { dispatchNotification } from './notification-preferences.service';

/** Whoever can approve a self-registration — the same key the approvals endpoints require. */
export const APPROVER_PERMISSION_KEY = 'members.edit_all';

/**
 * Tells the association's approvers (in-app + push + email, preference-aware) that someone registered and is waiting for approval.
 * The push opens the Pending approvals screen (`user.approval_pending`). Best-effort: a failure never fails the registration.
 */
export async function notifyApprovalPending(associationId: number, registrant: { userId: number; name: string }): Promise<void> {
  try {
    const rows = await prisma.userRole.findMany({
      where: {
        associationId,
        isActive: true,
        user: { isActive: true },
        role: { isActive: true, permissions: { some: { permission: { key: APPROVER_PERMISSION_KEY } } } },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of rows) {
      if (userId === registrant.userId) continue;
      try {
        await dispatchNotification({
          associationId,
          userId,
          kind: 'approval',
          entityId: registrant.userId,
          pushType: 'user.approval_pending',
          title: 'New member waiting for approval',
          message: `${registrant.name} registered and is waiting for you to approve their account.`,
        });
      } catch (error) {
        console.error(`Approval-pending notification failed for user ${userId} (non-critical):`, error);
      }
    }
  } catch (error) {
    console.error('Approval-pending notification failed (non-critical):', error);
  }
}
