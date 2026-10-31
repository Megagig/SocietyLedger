'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, NativeSelect, Textarea } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { AdminOrderEditor } from '@/components/ajo/AdminOrderEditor';
import { OrderTransparency } from '@/components/ajo/OrderTransparency';
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
  const [warnUnapproved, setWarnUnapproved] = useState(false);

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

      <OrderTransparency groupId={groupId} order={data} />

      {data.method === 'ADMIN_SET' && data.canSet && approvePayout && canWrite && <AdminOrderEditor groupId={groupId} order={data} rerun={data.drawn} />}
      {data.method === 'ADMIN_SET' && data.canSet && !(approvePayout && canWrite) && <p className="rounded-md bg-info-soft p-3 text-sm text-info-text">Only an admin can set the order for this circle.</p>}

      {!data.drawn && data.method === 'RANDOM_DRAW' ? (
        <section className="rounded-lg border border-line p-5">
          <h2 className="font-semibold">The order has not been drawn yet.</h2>
          <p className="mt-1 text-sm text-ink-muted">The draw is random, recorded with its seed so anyone can check it later, and it happens once. Do it after everyone has joined and before the circle starts.</p>
          {data.pendingPeople > 0 && <p className="mt-2 text-sm text-warning-strong">{data.pendingPeople} {data.pendingPeople === 1 ? 'person has' : 'people have'} joined but {data.pendingPeople === 1 ? 'is' : 'are'} not approved yet. {data.pendingPeople === 1 ? 'They are' : 'They are'} not in a draw made now.</p>}
          {can && data.canDraw && <Button className="mt-3" color="green" onClick={() => (data.pendingPeople > 0 ? setWarnUnapproved(true) : run(() => draw.mutateAsync(), 'The order was drawn.'))} loading={draw.isPending}>Draw the order</Button>}
          {can && !data.canDraw && group?.status !== 'OPEN' && <p className="mt-2 text-sm text-ink-faint">The draw is made while the circle is open for joining.</p>}
        </section>
      ) : !data.drawn ? null : (
        <section className="space-y-3">
          {data.stale && data.method === 'RANDOM_DRAW' && (
            <div className="space-y-2 rounded-lg border border-warning-line bg-warning-soft p-4" role="status">
              <p className="font-semibold text-warning-strong">This draw is out of date.</p>
              <p className="text-sm text-warning-strong">{data.staleBecause}. An order drawn for a different circle cannot be used, so the circle cannot start until it is drawn again. The old draw stays on the record.</p>
              {data.pendingPeople > 0 && <p className="text-sm text-warning-strong">{data.pendingPeople} {data.pendingPeople === 1 ? 'person is' : 'people are'} still waiting for approval and would not be in the new draw.</p>}
              {can && data.canDraw && <Button color="green" onClick={() => (data.pendingPeople > 0 ? setWarnUnapproved(true) : run(() => draw.mutateAsync(), 'The order was drawn again.'))} loading={draw.isPending}>Draw again</Button>}
            </div>
          )}
          {data.stale && data.method === 'ADMIN_SET' && (
            <div className="rounded-lg border border-warning-line bg-warning-soft p-4" role="status">
              <p className="font-semibold text-warning-strong">This order is out of date.</p>
              <p className="text-sm text-warning-strong">{data.staleBecause}. Set the order again above before the circle can start. The old one stays on the record.</p>
            </div>
          )}
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
          <Button disabled={!a || !b || a === b} onClick={() => run(() => request.mutateAsync({ slotAId: Number(a), slotBId: Number(b), reason: reason.trim() || undefined }), 'The swap was requested.')} loading={request.isPending}>Request the swap</Button>
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

      <Modal opened={warnUnapproved} onClose={() => setWarnUnapproved(false)} title="Draw before everyone is approved?" centered>
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">{data.pendingPeople} {data.pendingPeople === 1 ? 'person has' : 'people have'} joined but {data.pendingPeople === 1 ? 'is' : 'are'} not approved yet, so {data.pendingPeople === 1 ? 'they' : 'they'} will not be in this draw. If you approve {data.pendingPeople === 1 ? 'them' : 'them'} afterwards, the draw will be out of date and you will have to draw again before the circle can start.</p>
          <p className="text-sm text-ink-muted">It is usually better to approve everyone first, then draw once.</p>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setWarnUnapproved(false)}>Not yet</Button>
            <Button color="green" onClick={async () => { setWarnUnapproved(false); await run(() => draw.mutateAsync(), data.drawn ? 'The order was drawn again.' : 'The order was drawn.'); }}>Draw anyway</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
