'use client';

import { useState } from 'react';
import { Button, Modal, Pagination } from '@mantine/core';
import { CoopButton } from '@/components/coop/CoopButton';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useDecidePayment, usePaymentRequests } from '@/lib/coop/hooks';
import { coopApi, coopErrorMessage } from '@/lib/coop/api';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatusTabs } from '@/components/coop/StatusTabs';
import { ReceiptButton } from '@/components/coop/ReceiptButton';
import { StatusPill } from '@/components/coop/StatusPill';
import { toast } from '@/lib/toast';
import { formatDate } from '@/utils/format';
import type { PaymentRequest, RequestStatus } from '@/lib/coop/types';

const TABS: Array<{ value: RequestStatus; label: string }> = [
  { value: 'PENDING', label: 'Awaiting' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const fieldClass =
  'mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

/**
 * Payment Requests: every payment a member has declared (one transfer, one proof, one or more lines). An officer checks the proof against the
 * bank statement and approves or rejects the WHOLE request; approving posts every line or none of them. Nobody decides their own payment.
 */
export default function PaymentRequestsPage() {
  const [status, setStatus] = useState<RequestStatus>('PENDING');
  const [page, setPage] = useState(1);
  const queue = usePaymentRequests({ status, page });
  const decide = useDecidePayment();

  const [approving, setApproving] = useState<PaymentRequest | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRequest | null>(null);
  const [reason, setReason] = useState('');

  const approve = async () => {
    if (!approving) return;
    try {
      await decide.mutateAsync({ id: approving.id, decision: 'approve' });
      toast.success('Payment approved and added to the member’s savings');
      setApproving(null);
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not approve the payment.'));
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (reason.trim().length < 3) return toast.error('Say why, so the member knows what to fix');
    try {
      await decide.mutateAsync({ id: rejecting.id, decision: 'reject', reason: reason.trim() });
      toast.success('Payment rejected');
      setRejecting(null);
      setReason('');
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not reject the payment.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHead title="Payment requests" subtitle="Check each proof against the bank statement, then approve or reject it." />

      <StatusTabs
        label="Request status"
        tabs={TABS}
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        columns="grid-cols-3 sm:inline-flex"
      />

      {queue.isLoading ? (
        <CoopLoading />
      ) : queue.isError ? (
        <CoopError error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.data && queue.data.requests.length > 0 ? (
        <>
          <ul className="m-0 list-none space-y-3 p-0">
            {queue.data.requests.map((r) => (
              <li key={r.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {r.memberName} <span className="font-normal text-ink-muted">({r.memberNumber})</span>
                    </p>
                    <p className="text-sm text-ink-muted">
                      Paid {formatDate(r.paymentDate)} · submitted {formatDate(r.createdAt)}
                      {r.reference ? ` · ref ${r.reference}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ink">
                      <Naira value={r.totalAmount} />
                    </p>
                    <StatusPill status={r.status} />
                  </div>
                </div>

                <div className="relative mt-3 overflow-x-auto rounded-md border border-line-soft">
                  <table aria-label={`Lines of payment ${r.id}`} className="w-full min-w-[22rem] text-sm">
                    <thead className="bg-surface-muted text-left text-ink-muted">
                      <tr>
                        <th scope="col" className="px-3 py-1.5 font-medium">Savings type</th>
                        <th scope="col" className="px-3 py-1.5 font-medium">For</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines.map((l) => (
                        <tr key={l.id} className="border-t border-line-soft">
                          <td className="px-3 py-1.5">{l.accountTypeName}</td>
                          <td className="px-3 py-1.5">{l.periodLabel}</td>
                          <td className="px-3 py-1.5 text-right"><Naira value={l.amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {r.memberNote && <p className="mt-2 text-sm text-ink-muted">Member’s note: {r.memberNote}</p>}
                {r.status === 'REJECTED' && r.rejectionReason && <p className="mt-2 text-sm text-danger-text">Rejected: {r.rejectionReason}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.hasReceipt && <ReceiptButton getUrl={() => coopApi.paymentReceiptUrl(r.id)} />}
                  {r.status === 'PENDING' && (
                    <>
                      <CoopButton tone="primary" size="xs" leftSection={<IconCheck size={14} />} onClick={() => setApproving(r)}>
                        Approve
                      </CoopButton>
                      <CoopButton tone="danger-soft" size="xs" leftSection={<IconX size={14} />} onClick={() => setRejecting(r)}>
                        Reject
                      </CoopButton>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {queue.data.pagination.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination total={queue.data.pagination.totalPages} value={page} onChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <CoopEmpty title={status === 'PENDING' ? 'Nothing is waiting for you' : 'No payments here yet'} hint="Payments members declare will appear here with their proof." />
      )}

      <Modal opened={!!approving} onClose={() => setApproving(null)} title="Approve this payment?" centered>
        {approving && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              You are confirming that <strong>{approving.memberName}</strong> paid <Naira value={approving.totalAmount} /> and that it reached the cooperative’s bank account.
              Every line below is added to their savings at once.
            </p>
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              {approving.lines.map((l) => (
                <li key={l.id} className="flex justify-between border-b border-line-soft pb-1">
                  <span>{l.accountTypeName} · {l.periodLabel}</span>
                  <Naira value={l.amount} />
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => setApproving(null)}>Cancel</Button>
              <CoopButton tone="primary" onClick={approve} loading={decide.isPending}>Approve</CoopButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal opened={!!rejecting} onClose={() => { setRejecting(null); setReason(''); }} title="Reject this payment" centered>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink-soft">
            Reason (the member will see this)
            <textarea value={reason} rows={3} maxLength={500} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</Button>
            <CoopButton tone="danger" onClick={reject} loading={decide.isPending}>Reject payment</CoopButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
