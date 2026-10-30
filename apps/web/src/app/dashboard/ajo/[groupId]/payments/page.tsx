'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Checkbox, Modal, NativeSelect, Textarea } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatMoment } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { QueueContributionDTO } from '@/lib/ajo/staffTypes';
import { useQueue, usePeople } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';
import { useQueryClient } from '@tanstack/react-query';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'REPORTED', label: 'Transfers to confirm' },
  { value: 'CASH_RECEIVED', label: 'Cash waiting for handover' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Turned down' },
  { value: 'REVERSED', label: 'Reversed' },
];

/**
 * Confirming a payment is where money becomes real, so the two situations that need a second look are asked about in words: a proof
 * that looks like one already used, and confirming a payment you recorded yourself (only allowed when you are the only person who can).
 */
function ConfirmDialog({ item, name, onClose }: { item: QueueContributionDTO | null; name: string; onClose: () => void }) {
  const client = useQueryClient();
  const [ack, setAck] = useState(false);
  const [own, setOwn] = useState(false);
  const [note, setNote] = useState('');
  const [needs, setNeeds] = useState<{ duplicate: boolean; self: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setAck(false); setOwn(false); setNote(''); setNeeds(null); setProblem(null); setBusy(false); onClose(); };
  const submit = async () => {
    if (!item) return;
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.confirm(item.id, { acknowledgeDuplicate: ack || undefined, confirmOwn: own || undefined, note: note.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Confirmed. A receipt goes to the member.');
      close();
    } catch (error) {
      setBusy(false);
      const code = ajoErrorCode(error);
      if (code === 'DUPLICATE_ACK_REQUIRED') setNeeds({ duplicate: true, self: needs?.self ?? false, message: ajoErrorMessage(error) });
      else if (code === 'SELF_CONFIRM_NEEDS_NOTE') setNeeds({ duplicate: needs?.duplicate ?? false, self: true, message: ajoErrorMessage(error) });
      else setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={item !== null} onClose={close} title="Confirm this payment" centered>
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Confirm only after you have seen <strong><Money kobo={item.amountKobo} /></strong> from <strong>{name}</strong> in the circle&apos;s bank statement. Once confirmed it counts towards what they owe.</p>
          {needs?.duplicate && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needs.message}</p>
              <Checkbox label="I checked, and this is a different payment." checked={ack} onChange={(e) => setAck(e.currentTarget.checked)} />
            </div>
          )}
          {needs?.self && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needs.message}</p>
              <Checkbox label="I am the only person who can confirm here, and I checked it against the statement." checked={own} onChange={(e) => setOwn(e.currentTarget.checked)} />
              <Textarea label="How you checked" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </div>
          )}
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={close}>Cancel</Button><Button color="green" onClick={submit} loading={busy} disabled={(needs?.duplicate && !ack) || (needs?.self && (!own || note.trim().length < 5))}>Confirm payment</Button></div>
        </div>
      )}
    </Modal>
  );
}

/** THO4 (transfers and cash): the circle's payments, to confirm against the bank statement, turn down, or reverse with a reason. */
export default function PaymentsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { reconcile } = useAjoCan();
  const [status, setStatus] = useState('REPORTED');
  const queue = useQueue(groupId, status || undefined);
  const people = usePeople(groupId);
  const names = new Map((people.data ?? []).map((p) => [p.membershipId, p.name]));
  const [confirming, setConfirming] = useState<QueueContributionDTO | null>(null);
  const [rejecting, setRejecting] = useState<QueueContributionDTO | null>(null);
  const [reversing, setReversing] = useState<QueueContributionDTO | null>(null);
  const [proofProblem, setProofProblem] = useState<string | null>(null);
  const can = reconcile && canWrite;
  const [sending, setSending] = useState(false);
  const client2 = useQueryClient();
  const nameOf = (id: number) => names.get(id) ?? 'A member';

  const openProof = async (id: number) => {
    setProofProblem(null);
    try {
      const { url } = await ajoStaffApi.proofLink(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setProofProblem(ajoErrorMessage(error, 'Could not open the proof.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">Only confirmed money counts. Check each transfer against the bank statement before you confirm it. Cash recorded by a collector is confirmed when the collector&apos;s handover is reconciled.</p>
        <div className="flex flex-wrap items-end gap-2">
          {can && (
            <Button variant="default" size="xs" loading={sending} onClick={async () => { setProofProblem(null); setSending(true); try { const r = await ajoStaffApi.sendQueuedReceipts(); await client2.invalidateQueries({ queryKey: ['ajo'] }); toast.success(r.stillQueued ? `${r.sent} sent, ${r.stillQueued} still waiting (check your SMS credits).` : `${r.sent} receipt${r.sent === 1 ? '' : 's'} sent.`); } catch (error) { setProofProblem(ajoErrorMessage(error)); } finally { setSending(false); } }}>Send waiting receipts</Button>
          )}
          <NativeSelect aria-label="Show" data={FILTERS} value={status} onChange={(e) => setStatus(e.currentTarget.value)} />
        </div>
      </div>
      {proofProblem && <p role="alert" className="text-sm text-danger">{proofProblem}</p>}

      {queue.isLoading ? <AjoLoading /> : queue.isError ? <AjoError error={queue.error} onRetry={() => queue.refetch()} /> : queue.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 text-right font-medium">Amount</th><th className="px-4 py-2 font-medium">How and when</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {queue.items.map((c) => (
                <tr key={c.id} className="border-t border-line-soft align-top">
                  <td className="px-4 py-3 font-medium">{nameOf(c.membershipId)}{c.reference ? <span className="block text-xs font-normal text-ink-faint">{c.reference}</span> : null}</td>
                  <td className="px-4 py-3 text-right"><Money kobo={c.amountKobo} /></td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{c.method === 'CASH' ? 'Cash' : 'Bank transfer'} · {formatMoment(c.receivedAt)}{c.paidOn ? ` · paid ${formatDay(c.paidOn)}` : ''}{c.bankReference ? ` · ref ${c.bankReference}` : ''}{c.possibleDuplicateOf ? ' · may be a repeat' : ''}{c.missingFromHandover ? ' · missing from handover' : ''}{c.reversalReason ? ` · reversed: ${c.reversalReason}` : ''}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.reversed ? 'REVERSED' : c.status} /></td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {c.hasProof && <Button size="compact-xs" variant="subtle" onClick={() => openProof(c.id)}>See slip</Button>}
                    {can && c.status === 'REPORTED' && <><Button size="compact-xs" color="green" onClick={() => setConfirming(c)}>Confirm</Button><Button size="compact-xs" variant="default" onClick={() => setRejecting(c)}>Turn down</Button></>}
                    {can && c.counts && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setReversing(c)}>Reverse</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <AjoEmpty title={status === 'REPORTED' ? 'No transfers are waiting to be confirmed.' : 'Nothing here.'} />}

      {queue.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
          <span>Showing {queue.items.length} of {queue.total}</span>
          {queue.hasMore && <Button variant="default" size="xs" onClick={() => queue.fetchNextPage()} loading={queue.isFetchingNextPage}>Show more</Button>}
        </div>
      )}

      <ConfirmDialog item={confirming} name={confirming ? nameOf(confirming.membershipId) : ''} onClose={() => setConfirming(null)} />
      <ActionDialog opened={rejecting !== null} onClose={() => setRejecting(null)} title="Turn down this payment" color="red" confirmLabel="Turn it down" reasonMin={5} reasonLabel="Why (the member is told)" successMessage="The payment was turned down."
        summary={rejecting ? `${nameOf(rejecting.membershipId)} reported ${rejecting.amount}. It will not count, and they are told why.` : null}
        onConfirm={({ reason }) => ajoStaffApi.reject(rejecting?.id ?? 0, reason)} />
      <ActionDialog opened={reversing !== null} onClose={() => setReversing(null)} title="Reverse this payment" color="red" confirmLabel="Reverse it" reasonMin={10} reasonLabel="Why is it being reversed" successMessage="The payment was reversed and the reason recorded."
        summary={reversing ? `${nameOf(reversing.membershipId)}'s ${reversing.amount} will stop counting, and what it covered becomes owed again. The original stays on the record with your reason.` : null}
        onConfirm={({ reason }) => ajoStaffApi.reverse(reversing?.id ?? 0, reason)} />
    </div>
  );
}
