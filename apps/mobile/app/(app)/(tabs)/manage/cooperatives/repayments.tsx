import { loansApi } from '@/api/endpoints/loans';
import { RequestQueue } from '@/features/coopManage/components/RequestQueue';
import { useApproveRepayment, useRejectRepayment } from '@/features/coopManage/mutations';
import { COOP_LOANS_ACCESS, useRepaymentRequests } from '@/features/coopManage/queries';
import { formatMoney } from '@/lib/money';
import type { OfficerRepaymentRequestDTO, OfficerRepaymentRequestsDTO } from '@/types/api/coopManage';

const itemsOf = (page: OfficerRepaymentRequestsDTO) => page.repaymentRequests;
const contextOf = (request: OfficerRepaymentRequestDTO) => `Loan ${request.loanNumber}`;
const loadReceipt = (id: number) => loansApi.getRepaymentRequestReceiptUrl(id);
const approvedMessage = (request: OfficerRepaymentRequestDTO) => `Recorded ${formatMoney(request.amount)} against ${request.memberName}'s loan`;

/** project-overview.md §6.9 CP5 — members' loan repayments waiting for an officer to confirm the money landed. */
export default function RepaymentRequestsScreen() {
  return (
    <RequestQueue<OfficerRepaymentRequestDTO>
      title="Repayment requests"
      docsKey="CP5-REQ"
      access={COOP_LOANS_ACCESS}
      useRequests={useRepaymentRequests}
      itemsOf={itemsOf}
      contextOf={contextOf}
      loadReceipt={loadReceipt}
      useApprove={useApproveRepayment}
      useReject={useRejectRepayment}
      approvedMessage={approvedMessage}
      emptyHint="When a member says they paid towards their loan and attaches a receipt, it shows up here for you to confirm."
    />
  );
}
