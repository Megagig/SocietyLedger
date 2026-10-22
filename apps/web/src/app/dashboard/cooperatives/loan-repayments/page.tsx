'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Textarea, Button, Badge, Pagination, SegmentedControl } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconReceipt, IconCheck, IconX, IconWallet } from '@tabler/icons-react';
import {
  getLoanRepaymentRequests, getLoanRepaymentReceiptUrl, approveLoanRepaymentRequest, rejectLoanRepaymentRequest,
  type LoanRepaymentRequest, type SavingsDepositStatus
} from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';
import { HelpLink } from '@/components/docs/HelpLink';

const STATUS_TABS: { value: SavingsDepositStatus; label: string }[] = [
  { value: 'PENDING', label: 'Awaiting' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function LoanRepaymentsPage() {
  const [status, setStatus] = useState<SavingsDepositStatus>('PENDING');
  const [requests, setRequests] = useState<LoanRepaymentRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [approving, setApproving] = useState<LoanRepaymentRequest | null>(null);
  const [rejecting, setRejecting] = useState<LoanRepaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approveOpened, { open: openApprove, close: closeApprove }] = useDisclosure(false);
  const [rejectOpened, { open: openReject, close: closeReject }] = useDisclosure(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getLoanRepaymentRequests({ status, page, limit: 15 });
      setRequests(result.data.repaymentRequests || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
      setTotalCount(result.data.pagination?.totalCount || 0);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = (value: string) => {
    setPage(1);
    setStatus(value as SavingsDepositStatus);
  };

  const viewReceipt = async (request: LoanRepaymentRequest) => {
    try {
      const { url } = await getLoanRepaymentReceiptUrl(request.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startApprove = (request: LoanRepaymentRequest) => {
    setApproving(request);
    openApprove();
  };

  const startReject = (request: LoanRepaymentRequest) => {
    setRejecting(request);
    setRejectReason('');
    openReject();
  };

  const confirmApprove = async () => {
    if (!approving) return;
    setIsSubmitting(true);
    try {
      await approveLoanRepaymentRequest(approving.id);
      toast.success(`${formatCurrency(approving.amount)} recorded on loan ${approving.loanNumber}`);
      closeApprove();
      setApproving(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
      // Someone else may have just reviewed it, or the loan changed — refresh so the list is truthful.
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (rejectReason.trim().length < 3) {
      toast.error('Please give the member a reason');
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectLoanRepaymentRequest(rejecting.id, rejectReason.trim());
      toast.success('Payment rejected. The member has been told why.');
      closeReject();
      setRejecting(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Loan Repayments
        </h1>
          <HelpLink />
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Members declare the loan payments they made into the cooperative&apos;s bank account. Check your statement, then approve to record the repayment on their loan.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <SegmentedControl value={status} onChange={changeStatus} data={STATUS_TABS} fullWidth className="sm:w-auto" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[240px] text-gray-600 dark:text-gray-400">Loading repayments...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconWallet size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {status === 'PENDING' ? 'Nothing waiting' : `No ${status.toLowerCase()} payments`}
          </h3>
          <p className="text-gray-500">
            {status === 'PENDING' ? 'New member loan payments will appear here for you to confirm.' : 'Nothing to show here yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          {requests.map((request) => (
            <div key={request.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white">{request.memberName}</p>
                  <span className="text-xs text-gray-500">{request.memberNumber}</span>
                  {request.status !== 'PENDING' && (
                    <Badge color={request.status === 'APPROVED' ? 'green' : 'red'} size="sm">
                      {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </Badge>
                  )}
                </div>
                <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(request.amount)}</p>
                <p className="text-sm text-gray-500">
                  Paid {formatDate(request.paymentDate)} · Loan {request.loanNumber}
                  {request.reference ? ` · Ref ${request.reference}` : ''} · Submitted {formatDate(request.createdAt)}
                </p>
                {request.memberNote && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">&ldquo;{request.memberNote}&rdquo;</p>}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <p className="text-sm text-red-600 mt-1">Reason: {request.rejectionReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {request.hasReceipt && (
                  <Button variant="light" leftSection={<IconReceipt size={16} />} onClick={() => viewReceipt(request)}>
                    View receipt
                  </Button>
                )}
                {request.status === 'PENDING' && (
                  <>
                    <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => startApprove(request)}>
                      Approve
                    </Button>
                    <Button color="red" variant="outline" leftSection={<IconX size={16} />} onClick={() => startReject(request)}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2">
          <Pagination total={totalPages} value={page} onChange={setPage} />
          <p className="text-xs text-gray-500">{totalCount} payments</p>
        </div>
      )}

      {/* Approve */}
      <Modal opened={approveOpened} onClose={closeApprove} title="Approve this payment?" size="md">
        {approving && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Only approve after you have seen <strong>{formatCurrency(approving.amount)}</strong> arrive in the cooperative&apos;s
              bank account. It will be recorded on loan {approving.loanNumber} straight away (and any savings held against the loan
              are released in proportion), and cannot be undone here.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeApprove}>Cancel</Button>
              <Button color="green" loading={isSubmitting} onClick={confirmApprove}>Yes, record repayment</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject */}
      <Modal opened={rejectOpened} onClose={closeReject} title="Reject this payment" size="md">
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {rejecting.memberName}&apos;s {formatCurrency(rejecting.amount)} will not be recorded on their loan. They will be shown your reason.
            </p>
            <Textarea
              label="Reason"
              placeholder="e.g. No matching credit on the statement"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              required
              autosize
              minRows={2}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeReject}>Cancel</Button>
              <Button color="red" loading={isSubmitting} onClick={confirmReject}>Reject payment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
