'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, NativeSelect } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { ConfirmPaymentDialog } from '@/components/ajo/ConfirmPaymentDialog';
import { Money } from '@/components/ajo/Money';
import { RecordPaymentDialog } from '@/components/ajo/RecordPaymentDialog';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatMoment } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useGroups, useWaitingPayments } from '@/lib/ajo/staffHooks';
import type { WaitingPaymentDTO } from '@/lib/ajo/staffTypes';
import { useAjoCan } from '@/lib/ajo/useAjoCan';

const FILTERS = [
  { value: 'REPORTED', label: 'Transfers to confirm' },
  { value: 'CASH_RECEIVED', label: 'Cash waiting for handover' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Turned down' },
];

/**
 * Payments across every circle, in one place: what members have reported and are waiting to be confirmed against the bank statement, with
 * the slip, and Confirm or Turn down. An officer can also record a payment for a member who paid but did not report it.
 */
export default function AllPaymentsPage() {
  const { canWrite } = useAjoAccess();
  const { reconcile, manage } = useAjoCan();
  const [status, setStatus] = useState('REPORTED');
  const [groupId, setGroupId] = useState('');
  const groups = useGroups();
  const waiting = useWaitingPayments(status, groupId ? Number(groupId) : undefined);
  const [confirming, setConfirming] = useState<WaitingPaymentDTO | null>(null);
  const [rejecting, setRejecting] = useState<WaitingPaymentDTO | null>(null);
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const can = reconcile && canWrite;

  const openProof = async (id: number) => {
    setProblem(null);
    try {
      const { url } = await ajoStaffApi.proofLink(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not open the proof.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">Payments</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">Only confirmed money counts. Check each transfer against the bank statement before you confirm it. Cash recorded by a collector is confirmed when the collector&apos;s handover is counted.</p>
        </div>
        {(reconcile || manage) && canWrite && (
          <Button color="green" onClick={() => setRecording(true)}>
            Record a payment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <NativeSelect aria-label="Show" data={FILTERS} value={status} onChange={(e) => setStatus(e.currentTarget.value)} />
        <NativeSelect aria-label="Circle" data={[{ value: '', label: 'All circles' }, ...(groups.data ?? []).map((g) => ({ value: String(g.id), label: g.name }))]} value={groupId} onChange={(e) => setGroupId(e.currentTarget.value)} />
      </div>
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}

      {waiting.isLoading ? (
        <AjoLoading />
      ) : waiting.isError ? (
        <AjoError error={waiting.error} onRetry={() => waiting.refetch()} />
      ) : waiting.data && waiting.data.items.length > 0 ? (
        <ul className="divide-y divide-line-soft rounded-lg border border-line">
          {waiting.data.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {p.memberName} · <Money kobo={p.amountKobo} />
                </p>
                <p className="text-xs text-ink-muted">
                  <Link href={`/dashboard/ajo/${p.groupId}/payments`} className="underline">
                    {p.groupName}
                  </Link>
                  {' · '}
                  {p.method === 'CASH' ? 'Cash' : 'Transfer'} · reported {formatMoment(p.receivedAt)}
                  {p.paidOn ? ` · paid ${formatDay(p.paidOn)}` : ''}
                  {p.bankReference ? ` · ref ${p.bankReference}` : ''}
                </p>
                {p.possibleDuplicateOf ? <p className="text-xs text-warning-strong">This looks like a payment already on record. Check the statement.</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                {p.hasProof && (
                  <Button size="compact-xs" variant="subtle" onClick={() => openProof(p.id)}>
                    See slip
                  </Button>
                )}
                {can && p.status === 'REPORTED' && (
                  <>
                    <Button size="compact-xs" color="green" onClick={() => setConfirming(p)}>
                      Confirm
                    </Button>
                    <Button size="compact-xs" variant="subtle" color="red" onClick={() => setRejecting(p)}>
                      Turn down
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <AjoEmpty title={status === 'REPORTED' ? 'Nothing is waiting to be confirmed.' : 'No payments here.'} hint="When a member reports a transfer, it shows here with the slip." />
      )}

      <ConfirmPaymentDialog item={confirming} name={confirming?.memberName ?? ''} onClose={() => setConfirming(null)} />
      <ActionDialog
        opened={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Turn down this payment"
        color="red"
        confirmLabel="Turn it down"
        reasonMin={5}
        reasonLabel="Why (the member is told)"
        successMessage="The payment was turned down."
        summary={rejecting ? `${rejecting.memberName} reported ${rejecting.amount}. It will not count, and they are told why.` : null}
        onConfirm={({ reason }) => ajoStaffApi.reject(rejecting?.id ?? 0, reason)}
      />
      <RecordPaymentDialog opened={recording} onClose={() => setRecording(false)} canConfirm={reconcile} />
    </div>
  );
}
