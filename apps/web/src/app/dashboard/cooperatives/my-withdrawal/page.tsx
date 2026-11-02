'use client';

import { useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { CoopButton } from '@/components/coop/CoopButton';
import { useDisclosure } from '@mantine/hooks';
import { IconCalendarEvent, IconHistory, IconWallet } from '@tabler/icons-react';
import { useCancelWithdrawal, useMyWithdrawals, useRequestWithdrawal, useWithdrawalSummary } from '@/lib/coop/hooks';
import { coopErrorMessage } from '@/lib/coop/api';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatTile } from '@/components/coop/StatTile';
import { StatusPill } from '@/components/coop/StatusPill';
import { toast } from '@/lib/toast';
import { formatDate, formatNairaFull } from '@/utils/format';
import type { Withdrawal } from '@/lib/coop/types';

const fieldClass =
  'mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

/** Where a request is, in words: who has looked at it and what it is waiting for. */
function progress(w: Withdrawal) {
  if (w.status === 'PENDING_REVIEW') return 'Waiting for an officer to review it.';
  if (w.status === 'PENDING_APPROVAL') return w.twoStage ? 'Reviewed. Waiting for a second officer to approve and pay.' : 'Waiting for an officer to approve and pay.';
  if (w.status === 'APPROVED') return `Approved${w.payoutMethod ? ` and paid by ${w.payoutMethod.replace(/_/g, ' ').toLowerCase()}` : ''}${w.payoutReference ? ` (ref ${w.payoutReference})` : ''}.`;
  if (w.status === 'REJECTED') return w.rejectionReason ? `Not approved: ${w.rejectionReason}` : 'Not approved.';
  return 'You cancelled this request.';
}

/**
 * My Withdrawal: ask to take money out of a withdrawable savings type and follow the request. The balance only moves when an officer finally
 * approves it; until then nothing leaves your savings, and you can cancel.
 */
export default function MyWithdrawalPage() {
  const summary = useWithdrawalSummary();
  const history = useMyWithdrawals();
  const request = useRequestWithdrawal();
  const cancel = useCancelWithdrawal();
  const [opened, { open, close }] = useDisclosure(false);

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const accounts = summary.data?.accounts ?? [];
  const chosen = accounts.find((a) => String(a.savingsAccountId) === accountId);

  const reset = () => {
    setAccountId('');
    setAmount('');
    setReason('');
  };

  const send = async () => {
    const value = Number(amount);
    if (!chosen) return toast.error('Choose the savings to withdraw from');
    if (!value || value <= 0) return toast.error('Enter an amount above zero');
    if (value > Number(chosen.balance)) return toast.error(`That is more than the ${formatNairaFull(chosen.balance)} you have there`);
    if (chosen.remainingThisMonth !== null && value > Number(chosen.remainingThisMonth)) {
      return toast.error(`You can withdraw up to ${formatNairaFull(chosen.remainingThisMonth)} more this month`);
    }
    try {
      await request.mutateAsync({ savingsAccountId: chosen.savingsAccountId, amount: value, reason: reason.trim() || undefined });
      toast.success('Withdrawal requested. You will be told when it is decided.');
      reset();
      close();
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not request the withdrawal.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Withdrawal history"
        subtitle="Manage and track your withdrawal requests."
        actions={
          <CoopButton tone="primary" onClick={open} disabled={accounts.length === 0}>
            New withdrawal request
          </CoopButton>
        }
      />

      {summary.isLoading ? (
        <CoopLoading rows={1} height={96} />
      ) : summary.isError || !summary.data ? (
        <CoopError error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <section aria-label="Withdrawal summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Available to withdraw from" value={summary.data.totalBalance} tone="info" icon={<IconWallet size={20} />} />
          <StatTile label="Total withdrawals" value={summary.data.totalWithdrawals} tone="success" icon={<IconHistory size={20} />} />
          <StatTile
            label="Monthly limit"
            value={summary.data.monthlyLimit}
            tone="neutral"
            icon={<IconCalendarEvent size={20} />}
            hint={summary.data.monthlyLimit ? undefined : 'No monthly limit set'}
          />
          <StatTile
            label="Last withdrawal"
            value={summary.data.lastWithdrawal?.amount ?? null}
            tone="warning"
            hint={summary.data.lastWithdrawal?.at ? formatDate(summary.data.lastWithdrawal.at) : 'No withdrawals yet'}
          />
        </section>
      )}

      {history.isLoading ? (
        <CoopLoading />
      ) : history.isError ? (
        <CoopError error={history.error} onRetry={() => history.refetch()} />
      ) : history.data && history.data.requests.length > 0 ? (
        <ul className="m-0 list-none space-y-3 p-0">
          {history.data.requests.map((w) => (
            <li key={w.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">
                    <Naira value={w.amount} />
                  </p>
                  <p className="text-sm text-ink-muted">
                    {w.accountTypeName} · requested {formatDate(w.createdAt)}
                  </p>
                </div>
                <StatusPill status={w.status} />
              </div>
              <p className="mt-2 text-sm text-ink-soft">{progress(w)}</p>
              {w.reason && <p className="mt-1 text-sm text-ink-muted">Your reason: {w.reason}</p>}
              {(w.status === 'PENDING_REVIEW' || w.status === 'PENDING_APPROVAL') && (
                <div className="mt-3">
                  <CoopButton tone="danger-soft"
                    size="xs"
                    loading={cancel.isPending && cancel.variables === w.id}
                    onClick={async () => {
                      try {
                        await cancel.mutateAsync(w.id);
                        toast.success('Withdrawal cancelled');
                      } catch (error) {
                        toast.error(coopErrorMessage(error, 'We could not cancel it.'));
                      }
                    }}
                  >
                    Cancel request
                  </CoopButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <CoopEmpty title="No withdrawal requests found." hint="When you ask to withdraw, it will appear here with where it has got to." />
      )}

      <Modal opened={opened} onClose={close} title="New withdrawal request" centered>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink-soft">
            Withdraw from
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass}>
              <option value="">Choose a savings type</option>
              {accounts.map((a) => (
                <option key={a.savingsAccountId} value={a.savingsAccountId} disabled={a.hasPending}>
                  {a.accountTypeName} · {formatNairaFull(a.balance)}
                  {a.hasPending ? ' (a request is already waiting)' : ''}
                </option>
              ))}
            </select>
          </label>
          {chosen && (
            <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">
              Balance <Naira value={chosen.balance} />
              {chosen.remainingThisMonth !== null && (
                <>
                  {' '}
                  · You can still withdraw <Naira value={chosen.remainingThisMonth} /> this month
                </>
              )}
            </p>
          )}
          <label className="block text-sm font-medium text-ink-soft">
            Amount (₦)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-ink-soft">
            Reason (optional)
            <textarea value={reason} rows={2} maxLength={500} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} h-auto py-2`} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <CoopButton tone="primary" onClick={send} loading={request.isPending}>
              Request withdrawal
            </CoopButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
