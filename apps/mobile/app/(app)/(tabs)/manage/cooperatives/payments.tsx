import { RequestQueue } from '@/features/coopManage/components/RequestQueue';
import type { RequestLike } from '@/features/coopManage/components/RequestCard';
import { COOP_SAVINGS_ACCESS } from '@/features/coopManage/queries';
import { loadPaymentProof, useApprovePaymentRequest, usePaymentRequestQueue, useRejectPaymentRequest } from '@/features/coopEnhanced/queries';
import { formatMoney } from '@/lib/money';
import type { PaymentRequestDTO, PaymentRequestsDTO } from '@/types/api/coopEnhanced';

/** A payment request as the queue card reads it: the total, and the lines (type and month) as its context. */
type Row = RequestLike & { lines: string };

const toRow = (r: PaymentRequestDTO): Row => ({
  id: r.id,
  memberId: r.memberId,
  memberName: r.memberName,
  memberNumber: r.memberNumber,
  amount: r.totalAmount,
  paymentDate: r.paymentDate,
  reference: r.reference,
  memberNote: r.memberNote,
  hasReceipt: r.hasReceipt,
  status: r.status,
  rejectionReason: r.rejectionReason,
  lines: r.lines.map((l) => `${l.accountTypeName} ${l.periodLabel} ${formatMoney(l.amount)}`).join(' · '),
});

const itemsOf = (page: PaymentRequestsDTO) => page.requests.map(toRow);
const contextOf = (row: Row) => row.lines;
const approvedMessage = (row: Row) => `Added ${formatMoney(row.amount)} to ${row.memberName}'s savings`;

/**
 * Payment requests: every payment a member has declared (one transfer, one proof, one or more lines). Check the proof against the bank
 * statement, then approve or reject the WHOLE request: approving posts every line or none of them. Nobody decides their own payment.
 */
export default function PaymentRequestsScreen() {
  return (
    <RequestQueue<Row>
      title="Payment requests"
      docsKey="CP2-REQ"
      access={COOP_SAVINGS_ACCESS}
      useRequests={usePaymentRequestQueue}
      itemsOf={itemsOf}
      contextOf={contextOf}
      loadReceipt={loadPaymentProof}
      useApprove={useApprovePaymentRequest}
      useReject={useRejectPaymentRequest}
      approvedMessage={approvedMessage}
      emptyHint="When a member says they paid into the cooperative's account and attaches a receipt, it shows up here for you to confirm."
    />
  );
}
