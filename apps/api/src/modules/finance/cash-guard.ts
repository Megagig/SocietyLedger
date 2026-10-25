import { prisma } from '../../lib/prisma';

/**
 * Charges that were paid through a cash receipt (cash collections) can't be deleted from here: the receipt, the collector's cash in hand
 * and the lodgment total all point at that payment. Returns the receipt numbers in the way so the officer is told what to void first.
 */
export async function findCashBackingReceipts(associationId: number, transactionIds: number[]): Promise<string[]> {
  if (transactionIds.length === 0) return [];

  const payments = await prisma.payment.findMany({ where: { associationId, transactionId: { in: transactionIds } }, select: { id: true } });
  const donations = await prisma.donationRecord.findMany({ where: { transactionId: { in: transactionIds } }, select: { id: true } });
  const paymentIds = payments.map((p) => p.id);
  const donationIds = donations.map((d) => d.id);
  if (paymentIds.length === 0 && donationIds.length === 0) return [];

  const items = await prisma.cashReceiptItem.findMany({
    where: {
      receipt: { associationId, status: 'ACTIVE' },
      OR: [
        { kind: { in: ['DUES', 'LEVY'] }, sourceId: { in: paymentIds } },
        { kind: 'DONATION', sourceId: { in: donationIds } },
      ],
    },
    select: { receipt: { select: { receiptNumber: true } } },
  });
  return [...new Set(items.map((i) => i.receipt.receiptNumber))];
}

export function cashBackedMessage(receiptNumbers: string[]): string {
  const list = receiptNumbers.slice(0, 3).join(', ') + (receiptNumbers.length > 3 ? '…' : '');
  return `This was paid in cash (receipt ${list}). Void that cash receipt first, then delete the charge.`;
}
