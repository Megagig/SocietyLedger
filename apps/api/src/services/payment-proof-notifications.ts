import { prisma } from '../lib/prisma';
import { dispatchNotification } from './notification-preferences.service';

/** Whoever can verify a payment proof — the same key the verify endpoint requires. */
export const PROOF_APPROVER_PERMISSION_KEY = 'payments.approve';

/**
 * Tells the officers who can verify proofs that one is waiting (in-app + push + email, preference-aware). The push opens that
 * proof (`payment.proof_submitted`). Best-effort: a failure never reaches the member's upload.
 */
export async function notifyProofSubmitted(associationId: number, proof: { id: number; memberUserId: number | null; memberName: string }): Promise<void> {
  try {
    const rows = await prisma.userRole.findMany({
      where: {
        associationId,
        isActive: true,
        user: { isActive: true },
        role: { isActive: true, permissions: { some: { permission: { key: PROOF_APPROVER_PERMISSION_KEY } } } },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of rows) {
      if (userId === proof.memberUserId) continue;
      try {
        await dispatchNotification({
          associationId,
          userId,
          kind: 'approval',
          entityId: proof.id,
          pushType: 'payment.proof_submitted',
          title: 'Payment proof waiting',
          message: `${proof.memberName} submitted a payment proof for you to verify.`,
        });
      } catch (error) {
        console.error(`Proof-submitted notification failed for user ${userId} (non-critical):`, error);
      }
    }
  } catch (error) {
    console.error('Proof-submitted notification failed (non-critical):', error);
  }
}

/** Tells the member how their proof was decided; a rejection carries the officer's reason so they know what to fix. Best-effort. */
export async function notifyProofDecided(
  associationId: number,
  proof: { id: number; status: string; rejectionReason?: string | null; member: { userId: number | null } },
): Promise<void> {
  const userId = proof.member.userId;
  if (!userId) return;
  try {
    const approved = proof.status === 'APPROVED';
    await dispatchNotification({
      associationId,
      userId,
      kind: approved ? 'payment_received' : 'system',
      entityId: proof.id,
      pushType: approved ? 'payment.proof_verified' : 'payment.proof_rejected',
      title: approved ? 'Payment confirmed' : 'Payment proof not accepted',
      message: approved
        ? 'Your payment proof was verified and your balance has been updated.'
        : `Your payment proof was not accepted${proof.rejectionReason ? `: ${proof.rejectionReason}` : '.'} You can submit it again.`,
    });
  } catch (error) {
    console.error('Proof-decision notification failed (non-critical):', error);
  }
}
