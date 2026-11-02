'use client';

import { useState } from 'react';
import { Button, Modal, Pagination } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useApproveWithdrawal, useRejectWithdrawal, useReviewWithdrawal, useWithdrawalQueue } from '@/lib/coop/hooks';
import { coopErrorMessage } from '@/lib/coop/api';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatusPill } from '@/components/coop/StatusPill';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/lib/toast';
import { formatDate } from '@/utils/format';
import type { Withdrawal, WithdrawalStatus } from '@/lib/coop/types';

const TABS: Array<{ value: WithdrawalStatus; label: string }> = [
  { value: 'PENDING_REVIEW', label: 'To review' },
  { value: 'PENDING_APPROVAL', label: 'To approve' },
  { value: 'APPROVED', label: 'Paid out' },
  { value: 'REJECTED', label: 'Rejected' },
];

const fieldClass =
  'mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

type Dialog =
  | { kind: 'forward'; w: Withdrawal }
  | { kind: 'reject-review'; w: Withdrawal }
  | { kind: 'approve'; w: Withdrawal }
  | { kind: 'reject-final'; w: Withdrawal }
  | null;

/**
 * Withdrawals: members ask to take money out; two different officers decide. Stage one (review) checks eligibility and passes it on or rejects
 * it; stage two (approve and pay) records how it was paid out. The member, the reviewer and the approver must be three different people, and
 * the balance moves only at final approval, when the balance, the loan hold and the monthly limit are checked again.
 */
export default function WithdrawalsPage() {
  const { can } = usePermissions();
  const canReview = can(PERMISSIONS.COOPERATIVE_WITHDRAWAL_REVIEW);
  const canApprove = can(PERMISSIONS.COOPERATIVE_WITHDRAWAL_APPROVE);
  const me = useAuthStore((s) => s.user?.id);

  const [status, setStatus] = useState<WithdrawalStatus>(canReview || !canApprove ? 'PENDING_REVIEW' : 'PENDING_APPROVAL');
  const [page, setPage] = useState(1);
  const queue = useWithdrawalQueue({ status, page });
  const review = useReviewWithdrawal();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const close = () => {
    setDialog(null);
    setText('');
    setReference('');
    setMethod('BANK_TRANSFER');
  };
  const busy = review.isPending || approve.isPending || reject.isPending;

  const submit = async () => {
    if (!dialog) return;
    try {
      if (dialog.kind === 'forward') {
        await review.mutateAsync({ id: dialog.w.id, body: { decision: 'FORWARD', comment: text.trim() || undefined } });
        toast.success('Passed on for final approval');
      } else if (dialog.kind === 'reject-review') {
        if (text.trim().length < 3) return toast.error('Say why, so the member knows what to fix');
        await review.mutateAsync({ id: dialog.w.id, body: { decision: 'REJECT', reason: text.trim() } });
        toast.success('Withdrawal rejected');
      } else if (dialog.kind === 'approve') {
        await approve.mutateAsync({ id: dialog.w.id, body: { payoutMethod: method, payoutReference: reference.trim() || undefined, comment: text.trim() || undefined } });
        toast.success('Withdrawal approved and recorded');
      } else {
        if (text.trim().length < 3) return toast.error('Say why, so the member knows what to fix');
        await reject.mutateAsync({ id: dialog.w.id, reason: text.trim() });
        toast.success('Withdrawal rejected');
      }
      close();
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not record that decision.'));
    }
  };

  /** What this officer may do with a request, and why not when they may not. */
  const actionsFor = (w: Withdrawal) => {
    if (w.status === 'PENDING_REVIEW') {
      return canReview ? { review: true } : { note: 'Waiting for an officer with permission to review.' };
    }
    if (w.status === 'PENDING_APPROVAL') {
      if (!canApprove) return { note: 'Waiting for an officer with permission to approve.' };
      if (w.twoStage && w.reviewedBy === me) return { note: 'You reviewed this request, so a different officer needs to approve it.' };
      return { approve: true };
    }
    return {};
  };

  return (
    <div className="space-y-6">
      <PageHead title="Withdrawals" subtitle="Member withdrawal requests, decided in two stages by two different officers." />

      <div role="tablist" aria-label="Withdrawal status" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1 sm:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={`h-11 rounded-md border border-transparent px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-success-focus ${status === t.value ? 'bg-success-solid text-on-solid' : 'bg-transparent text-ink-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <CoopLoading />
      ) : queue.isError ? (
        <CoopError error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.data && queue.data.requests.length > 0 ? (
        <>
          <ul className="m-0 list-none space-y-3 p-0">
            {queue.data.requests.map((w) => {
              const act = actionsFor(w);
              return (
                <li key={w.id} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {w.memberName} <span className="font-normal text-ink-muted">({w.memberNumber})</span>
                      </p>
                      <p className="text-sm text-ink-muted">
                        {w.accountTypeName} · {w.accountNumber} · requested {formatDate(w.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-ink">
                        <Naira value={w.amount} />
                      </p>
                      <StatusPill status={w.status} />
                    </div>
                  </div>
                  {w.reason && <p className="mt-2 text-sm text-ink-soft">Reason: {w.reason}</p>}
                  {w.reviewedAt && <p className="mt-1 text-sm text-ink-muted">Reviewed {formatDate(w.reviewedAt)}{w.reviewComment ? `: ${w.reviewComment}` : ''}</p>}
                  {w.status === 'APPROVED' && (
                    <p className="mt-1 text-sm text-success-text">
                      Paid out {w.payoutMethod ? `by ${w.payoutMethod.replace(/_/g, ' ').toLowerCase()}` : ''}
                      {w.payoutReference ? ` (ref ${w.payoutReference})` : ''}
                      {w.approvedAt ? ` on ${formatDate(w.approvedAt)}` : ''}.
                    </p>
                  )}
                  {w.status === 'REJECTED' && w.rejectionReason && <p className="mt-1 text-sm text-danger-text">Rejected: {w.rejectionReason}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {'review' in act && act.review && (
                      <>
                        <Button color="green" size="xs" leftSection={<IconCheck size={14} />} onClick={() => setDialog({ kind: 'forward', w })}>
                          Pass on for approval
                        </Button>
                        <Button color="red" variant="light" size="xs" leftSection={<IconX size={14} />} onClick={() => setDialog({ kind: 'reject-review', w })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {'approve' in act && act.approve && (
                      <>
                        <Button color="green" size="xs" leftSection={<IconCheck size={14} />} onClick={() => setDialog({ kind: 'approve', w })}>
                          Approve and pay
                        </Button>
                        <Button color="red" variant="light" size="xs" leftSection={<IconX size={14} />} onClick={() => setDialog({ kind: 'reject-final', w })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {'note' in act && act.note && <p className="text-sm text-ink-muted">{act.note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {queue.data.pagination.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination total={queue.data.pagination.totalPages} value={page} onChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <CoopEmpty title="No withdrawal requests here" hint="When a member asks to withdraw, it will appear under To review (or To approve, if your cooperative runs one stage)." />
      )}

      <Modal
        opened={!!dialog}
        onClose={close}
        centered
        title={
          dialog?.kind === 'forward' ? 'Pass on for approval' : dialog?.kind === 'approve' ? 'Approve and record the payout' : 'Reject this withdrawal'
        }
      >
        {dialog && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              {dialog.w.memberName} · <Naira value={dialog.w.amount} /> from {dialog.w.accountTypeName}
            </p>
            {dialog.kind === 'approve' && (
              <>
                <label className="block text-sm font-medium text-ink-soft">
                  How was it paid out?
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink-soft">
                  Payout reference (optional)
                  <input type="text" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className={fieldClass} />
                </label>
              </>
            )}
            <label className="block text-sm font-medium text-ink-soft">
              {dialog.kind === 'reject-review' || dialog.kind === 'reject-final' ? 'Reason (the member will see this)' : 'Comment (optional)'}
              <textarea value={text} rows={3} maxLength={500} onChange={(e) => setText(e.target.value)} className={fieldClass} />
            </label>
            {dialog.kind === 'approve' && (
              <p className="rounded-md bg-surface-muted p-3 text-xs text-ink-muted">
                The balance moves now. The balance, any savings held against a loan, and the monthly limit are checked once more first.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={close}>Cancel</Button>
              <Button color={dialog.kind === 'reject-review' || dialog.kind === 'reject-final' ? 'red' : 'green'} onClick={submit} loading={busy}>
                {dialog.kind === 'forward' ? 'Pass on' : dialog.kind === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
