'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Textarea, Button, Badge, Pagination, SegmentedControl } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconReceipt, IconCheck, IconX, IconCurrencyNaira } from '@tabler/icons-react';
import {
  getSavingsDeposits, getSavingsDepositReceiptUrl, approveSavingsDeposit, rejectSavingsDeposit,
  type SavingsDeposit, type SavingsDepositStatus
} from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

const STATUS_TABS: { value: SavingsDepositStatus; label: string }[] = [
  { value: 'PENDING', label: 'Awaiting' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function SavingsDepositsPage() {
  const [status, setStatus] = useState<SavingsDepositStatus>('PENDING');
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [approving, setApproving] = useState<SavingsDeposit | null>(null);
  const [rejecting, setRejecting] = useState<SavingsDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approveOpened, { open: openApprove, close: closeApprove }] = useDisclosure(false);
  const [rejectOpened, { open: openReject, close: closeReject }] = useDisclosure(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSavingsDeposits({ status, page, limit: 15 });
      setDeposits(result.data.deposits || []);
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

  const viewReceipt = async (deposit: SavingsDeposit) => {
    try {
      const { url } = await getSavingsDepositReceiptUrl(deposit.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startApprove = (deposit: SavingsDeposit) => {
    setApproving(deposit);
    openApprove();
  };

  const startReject = (deposit: SavingsDeposit) => {
    setRejecting(deposit);
    setRejectReason('');
    openReject();
  };

  const confirmApprove = async () => {
    if (!approving) return;
    setIsSubmitting(true);
    try {
      await approveSavingsDeposit(approving.id);
      toast.success(`${formatCurrency(approving.amount)} added to ${approving.memberName}'s savings`);
      closeApprove();
      setApproving(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
      // Someone else may have just reviewed it — refresh so the list is truthful.
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
      await rejectSavingsDeposit(rejecting.id, rejectReason.trim());
      toast.success('Deposit rejected. The member has been told why.');
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
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Savings Deposits
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Members declare the savings they paid into the cooperative&apos;s bank account. Check your statement, then approve to add it to their savings.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <SegmentedControl value={status} onChange={changeStatus} data={STATUS_TABS} fullWidth className="sm:w-auto" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[240px] text-gray-600 dark:text-gray-400">Loading deposits...</div>
      ) : deposits.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <IconCurrencyNaira size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {status === 'PENDING' ? 'Nothing waiting' : `No ${status.toLowerCase()} deposits`}
          </h3>
          <p className="text-gray-500">
            {status === 'PENDING' ? 'New member deposits will appear here for you to confirm.' : 'Nothing to show here yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          {deposits.map((deposit) => (
            <div key={deposit.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white">{deposit.memberName}</p>
                  <span className="text-xs text-gray-500">{deposit.memberNumber}</span>
                  {deposit.status !== 'PENDING' && (
                    <Badge color={deposit.status === 'APPROVED' ? 'green' : 'red'} size="sm">
                      {deposit.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </Badge>
                  )}
                </div>
                <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(deposit.amount)}</p>
                <p className="text-sm text-gray-500">
                  Paid {formatDate(deposit.paymentDate)} · Account {deposit.accountNumber}
                  {deposit.reference ? ` · Ref ${deposit.reference}` : ''} · Submitted {formatDate(deposit.createdAt)}
                </p>
                {deposit.memberNote && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">&ldquo;{deposit.memberNote}&rdquo;</p>}
                {deposit.status === 'REJECTED' && deposit.rejectionReason && (
                  <p className="text-sm text-red-600 mt-1">Reason: {deposit.rejectionReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {deposit.hasReceipt && (
                  <Button variant="light" leftSection={<IconReceipt size={16} />} onClick={() => viewReceipt(deposit)}>
                    View receipt
                  </Button>
                )}
                {deposit.status === 'PENDING' && (
                  <>
                    <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => startApprove(deposit)}>
                      Approve
                    </Button>
                    <Button color="red" variant="outline" leftSection={<IconX size={16} />} onClick={() => startReject(deposit)}>
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
          <p className="text-xs text-gray-500">{totalCount} deposits</p>
        </div>
      )}

      {/* Approve */}
      <Modal opened={approveOpened} onClose={closeApprove} title="Approve this deposit?" size="md">
        {approving && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Only approve after you have seen <strong>{formatCurrency(approving.amount)}</strong> arrive in the cooperative&apos;s
              bank account. It will be added to {approving.memberName}&apos;s savings straight away and cannot be undone here.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeApprove}>Cancel</Button>
              <Button color="green" loading={isSubmitting} onClick={confirmApprove}>Yes, add to savings</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject */}
      <Modal opened={rejectOpened} onClose={closeReject} title="Reject this deposit" size="md">
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {rejecting.memberName}&apos;s {formatCurrency(rejecting.amount)} will not be added to their savings. They will be shown your reason.
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
              <Button color="red" loading={isSubmitting} onClick={confirmReject}>Reject deposit</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
