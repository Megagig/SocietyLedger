import { cooperativesApi } from '@/api/endpoints/cooperatives';
import { RequestQueue } from '@/features/coopManage/components/RequestQueue';
import { useApproveDeposit, useRejectDeposit } from '@/features/coopManage/mutations';
import { COOP_SAVINGS_ACCESS, useDepositRequests } from '@/features/coopManage/queries';
import { formatMoney } from '@/lib/money';
import type { OfficerDepositRequestDTO, OfficerDepositRequestsDTO } from '@/types/api/coopManage';

const itemsOf = (page: OfficerDepositRequestsDTO) => page.deposits;
const contextOf = (request: OfficerDepositRequestDTO) => `Account ${request.accountNumber}`;
const loadReceipt = (id: number) => cooperativesApi.getSavingsDepositReceiptUrl(id);
const approvedMessage = (request: OfficerDepositRequestDTO) => `Added ${formatMoney(request.amount)} to ${request.memberName}'s savings`;

/** project-overview.md §6.9 CP2 — members' savings deposits waiting for an officer to confirm the money landed. */
export default function DepositRequestsScreen() {
  return (
    <RequestQueue<OfficerDepositRequestDTO>
      title="Deposit requests"
      docsKey="CP2-REQ"
      access={COOP_SAVINGS_ACCESS}
      useRequests={useDepositRequests}
      itemsOf={itemsOf}
      contextOf={contextOf}
      loadReceipt={loadReceipt}
      useApprove={useApproveDeposit}
      useReject={useRejectDeposit}
      approvedMessage={approvedMessage}
      emptyHint="When a member says they paid into the cooperative's account and attaches a receipt, it shows up here for you to confirm."
    />
  );
}
