'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal, NativeSelect, TextInput, Textarea } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { HandoverDTO } from '@/lib/ajo/staffTypes';
import { useHandovers } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

/**
 * Reconciling a handover: the officer counts the cash and ticks the payments that were really there. Each ticked payment is confirmed;
 * anything left unticked is marked missing and stays unconfirmed. A collector's difference is never written off silently.
 */
function ReconcileDialog({ handover, onClose }: { handover: HandoverDTO | null; onClose: () => void }) {
  const client = useQueryClient();
  const [counted, setCounted] = useState('');
  const [received, setReceived] = useState<Set<number> | null>(null);
  const [note, setNote] = useState('');
  const [own, setOwn] = useState(false);
  const [needsOwn, setNeedsOwn] = useState<string | null>(null);
  const [payments, setPayments] = useState<Array<{ contributionId: number; reference: string | null; name: string; amountKobo: string; status: string }>>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load what was handed over each time a handover is opened; everything starts ticked, so the officer unticks what was not there.
  const handoverId = handover?.id;
  useEffect(() => {
    if (!handoverId) return;
    let cancelled = false;
    ajoStaffApi.handover(handoverId).then((detail) => {
      if (cancelled) return;
      setPayments(detail.payments);
      setReceived(new Set(detail.payments.map((p) => p.contributionId)));
    }).catch((error) => { if (!cancelled) setProblem(ajoErrorMessage(error)); });
    return () => { cancelled = true; };
  }, [handoverId]);
  const close = () => { setCounted(''); setReceived(null); setNote(''); setOwn(false); setNeedsOwn(null); setPayments([]); setProblem(null); setBusy(false); onClose(); };

  const submit = async () => {
    if (!handover) return;
    const kobo = nairaToKobo(counted || '0');
    if (kobo === null) return setProblem('Enter the cash you counted in naira, for example 25,000. Enter 0 if there was none.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.reconcileHandover(handover.id, { countedKobo: kobo.toString(), receivedContributionIds: [...(received ?? [])], note: note.trim() || undefined, confirmOwn: own || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('The handover was reconciled.');
      close();
    } catch (error) {
      setBusy(false);
      if (ajoErrorCode(error) === 'SELF_CONFIRM_NEEDS_NOTE') setNeedsOwn(ajoErrorMessage(error));
      else setProblem(ajoErrorMessage(error));
    }
  };

  const ticked = payments.filter((p) => received?.has(p.contributionId)).reduce((s, p) => s + Number(p.amountKobo), 0);
  return (
    <Modal opened={handover !== null} onClose={close} title="Reconcile this handover" centered size="lg">
      {handover && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">The collector says they handed over <strong><Money kobo={handover.handedOverKobo} /></strong> from <strong><Money kobo={handover.collectedKobo} /></strong> collected. Count the cash, then tick the payments that were really in it.</p>
          <TextInput label="Cash you counted (₦)" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.currentTarget.value)} />
          {payments.length === 0 ? <p className="text-sm text-ink-faint">No payments are attached to this handover.</p> : (
            <ul className="max-h-60 divide-y divide-line-soft overflow-y-auto rounded-lg border border-line">
              {payments.map((p) => (
                <li key={p.contributionId} className="px-3 py-2"><Checkbox label={`${p.name} · ${formatKobo(p.amountKobo)}${p.reference ? ` · ${p.reference}` : ''}`} checked={received?.has(p.contributionId) ?? false} onChange={(e) => setReceived((prev) => { const next = new Set(prev ?? []); if (e.currentTarget.checked) next.add(p.contributionId); else next.delete(p.contributionId); return next; })} /></li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-faint">Ticked payments add up to {formatKobo(String(ticked))}.</p>
          <Textarea label="Note (optional)" autosize minRows={1} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          {needsOwn && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needsOwn}</p>
              <Checkbox label="I am the only person who can reconcile here, and I counted it myself." checked={own} onChange={(e) => setOwn(e.currentTarget.checked)} />
            </div>
          )}
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={close}>Cancel</Button><Button color="green" onClick={submit} loading={busy} disabled={needsOwn !== null && (!own || note.trim().length < 5)}>Reconcile</Button></div>
        </div>
      )}
    </Modal>
  );
}

/** THO4 (cash side): what collectors have handed over, and which still need counting. */
export default function HandoversPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { reconcile } = useAjoCan();
  const [filter, setFilter] = useState('false');
  const handovers = useHandovers(groupId, filter === '' ? undefined : filter === 'true');
  const [reconciling, setReconciling] = useState<HandoverDTO | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">At the end of each day a collector hands over what they collected. You count it and tick what was really there. Only then is the cash confirmed and receipted.</p>
        <NativeSelect aria-label="Show" data={[{ value: 'false', label: 'Waiting to be counted' }, { value: 'true', label: 'Reconciled' }, { value: '', label: 'All' }]} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
      </div>
      {handovers.isLoading ? <AjoLoading /> : handovers.isError ? <AjoError error={handovers.error} onRetry={() => handovers.refetch()} /> : handovers.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted"><tr><th className="px-4 py-2 font-medium">Day</th><th className="px-4 py-2 text-right font-medium">Collected</th><th className="px-4 py-2 text-right font-medium">Handed over</th><th className="px-4 py-2 text-right font-medium">Difference</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
            <tbody>
              {handovers.items.map((h) => (
                <tr key={h.id} className="border-t border-line-soft">
                  <td className="px-4 py-3">{formatDay(h.forDate)}{h.note ? <span className="block text-xs text-ink-faint">{h.note}</span> : null}</td>
                  <td className="px-4 py-3 text-right"><Money kobo={h.collectedKobo} /></td>
                  <td className="px-4 py-3 text-right"><Money kobo={h.handedOverKobo} /></td>
                  <td className={`px-4 py-3 text-right ${h.differenceKobo !== '0' ? 'font-semibold text-danger' : ''}`}><Money kobo={h.differenceKobo} /></td>
                  <td className="px-4 py-3"><StatusBadge status={h.reconciled ? 'CONFIRMED' : 'PENDING'} label={h.reconciled ? 'Reconciled' : 'Waiting to be counted'} /></td>
                  <td className="px-4 py-3 text-right">{reconcile && canWrite && !h.reconciled && <Button size="compact-xs" color="green" onClick={() => setReconciling(h)}>Count and reconcile</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <AjoEmpty title="No handovers here." />}
      {handovers.hasMore && <div className="flex justify-center"><Button variant="default" size="xs" onClick={() => handovers.fetchNextPage()} loading={handovers.isFetchingNextPage}>Show more</Button></div>}
      <ReconcileDialog handover={reconciling} onClose={() => setReconciling(null)} />
    </div>
  );
}
