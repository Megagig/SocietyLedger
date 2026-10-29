'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, NativeSelect, Textarea } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatMoment, ordinal } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { OrderSlotDTO, SwapDTO } from '@/lib/ajo/staffTypes';
import { useAjoAction, useGroupDetail, useOrder, useSwaps } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

/** THO10: the recorded draw, who collects when, and the only two ways it can change: a swap before anyone is paid, or an emergency exception. */
export default function PayoutOrderPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const order = useOrder(groupId);
  const swaps = useSwaps(groupId);
  const draw = useAjoAction<void>(() => ajoStaffApi.runDraw(groupId));
  const request = useAjoAction((body: { slotAId: number; slotBId: number; reason?: string }) => ajoStaffApi.requestSwap(groupId, body));
  const decide = useAjoAction((input: { swapId: number; decision: 'APPROVED' | 'REJECTED' }) => ajoStaffApi.decideSwap(input.swapId, { decision: input.decision }));
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [reason, setReason] = useState('');
  const [exceptionSlot, setExceptionSlot] = useState<OrderSlotDTO | null>(null);
  const [newPosition, setNewPosition] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (order.isLoading) return <AjoLoading />;
  if (order.isError) return <AjoError error={order.error} onRetry={() => order.refetch()} />;
  const data = order.data;
  if (!data) return null;
  const slotName = (slotId: number) => {
    const s = data.slots.find((x) => x.slotId === slotId);
    return s ? `${s.name} (${ordinal(s.position)})` : `Place ${slotId}`;
  };
  const can = manage && canWrite;
  const nobodyPaidYet = data.slots.every((s) => !s.paid);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setProblem(null);
    try {
      await fn();
      toast.success(success);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      {problem && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-text">{problem}</p>}

      {!data.drawn ? (
        <section className="rounded-lg border border-line p-5">
          <h2 className="font-semibold">The order has not been drawn yet.</h2>
          <p className="mt-1 text-sm text-ink-muted">The draw is random, recorded with its seed so anyone can check it later, and it happens once. Do it after everyone has joined and before the circle starts.</p>
          {can && group?.status === 'OPEN' && <Button className="mt-3" color="green" onClick={() => run(() => draw.mutateAsync(), 'The order was drawn.')} loading={draw.isLoading}>Draw the order</Button>}
          {can && group?.status !== 'OPEN' && <p className="mt-2 text-sm text-ink-faint">The draw is made while the circle is open for joining.</p>}
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-ink-muted">Drawn {formatMoment(data.drawnAt)}. Seed <span className="font-mono">{data.seed}</span>.</p>
          <ol className="divide-y divide-line-soft rounded-lg border border-line">
            {data.slots.map((s) => (
              <li key={s.slotId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3"><span className="w-12 font-semibold tabular-nums">{ordinal(s.position)}</span><span>{s.name}{s.shareNo > 1 ? ` (share ${s.shareNo})` : ''}</span></div>
                <div className="flex items-center gap-2">
                  {s.paid && <StatusBadge status="PAID" label="Collected" />}
                  {approvePayout && canWrite && group?.status === 'ACTIVE' && !s.paid && <Button size="compact-xs" variant="subtle" onClick={() => { setExceptionSlot(s); setNewPosition(''); }}>Emergency change</Button>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {data.drawn && can && nobodyPaidYet && (
        <section className="space-y-3 rounded-lg border border-line p-5">
          <h2 className="font-semibold">Swap two places</h2>
          <p className="text-sm text-ink-muted">Allowed until the first payout is prepared. An admin approves each swap.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NativeSelect label="First place" data={[{ value: '', label: 'Choose…' }, ...data.slots.map((s) => ({ value: String(s.slotId), label: `${ordinal(s.position)} · ${s.name}` }))]} value={a} onChange={(e) => setA(e.currentTarget.value)} />
            <NativeSelect label="Second place" data={[{ value: '', label: 'Choose…' }, ...data.slots.map((s) => ({ value: String(s.slotId), label: `${ordinal(s.position)} · ${s.name}` }))]} value={b} onChange={(e) => setB(e.currentTarget.value)} />
          </div>
          <Textarea label="Reason (optional)" autosize minRows={1} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Button disabled={!a || !b || a === b} onClick={() => run(() => request.mutateAsync({ slotAId: Number(a), slotBId: Number(b), reason: reason.trim() || undefined }), 'The swap was requested.')} loading={request.isLoading}>Request the swap</Button>
        </section>
      )}

      {swaps.data && swaps.data.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Swap requests</h2>
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {swaps.data.map((s: SwapDTO) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div><p>{slotName(s.slotAId)} ↔ {slotName(s.slotBId)}</p>{s.reason && <p className="text-xs text-ink-faint">{s.reason}</p>}</div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status === 'PENDING' ? 'PENDING' : s.status === 'APPROVED' ? 'CONFIRMED' : 'REJECTED'} label={s.status === 'PENDING' ? 'Waiting for an admin' : s.status === 'APPROVED' ? 'Approved' : s.status === 'REJECTED' ? 'Turned down' : 'Withdrawn'} />
                  {s.status === 'PENDING' && approvePayout && canWrite && (
                    <>
                      <Button size="compact-xs" color="green" onClick={() => run(() => decide.mutateAsync({ swapId: s.id, decision: 'APPROVED' }), 'The swap was approved.')}>Approve</Button>
                      <Button size="compact-xs" variant="default" onClick={() => run(() => decide.mutateAsync({ swapId: s.id, decision: 'REJECTED' }), 'The swap was turned down.')}>Turn down</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.history.length > 0 && (
        <details className="rounded-lg border border-line p-4">
          <summary className="cursor-pointer font-medium">History of changes</summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">{data.history.map((h) => <li key={h.id}>{formatMoment(h.createdAt)} · {h.type.toLowerCase()}{h.reason ? ` · ${h.reason}` : ''}</li>)}</ul>
        </details>
      )}

      <ActionDialog opened={exceptionSlot !== null} onClose={() => setExceptionSlot(null)} title="Emergency change of place" color="red" confirmLabel="Make the change" reasonMin={10} reasonLabel="Why is this needed" successMessage="The place was changed and the reason recorded."
        summary={exceptionSlot ? `${exceptionSlot.name} is ${ordinal(exceptionSlot.position)}. Only use this for a real emergency, after the first payout has been made. It is recorded with your reason.` : null}
        extra={<NativeSelect label="Move to place" data={[{ value: '', label: 'Choose…' }, ...data.slots.filter((s) => !s.paid && s.slotId !== exceptionSlot?.slotId).map((s) => ({ value: String(s.position), label: ordinal(s.position) }))]} value={newPosition} onChange={(e) => setNewPosition(e.currentTarget.value)} />}
        validate={() => (newPosition ? null : 'Choose the place to move them to.')}
        onConfirm={({ reason: why }) => ajoStaffApi.exception(groupId, { slotId: exceptionSlot?.slotId ?? 0, newPosition: Number(newPosition), reason: why })} />

      {data.drawn && data.slots.length === 0 && <AjoEmpty title="There are no places yet." />}
    </div>
  );
}
