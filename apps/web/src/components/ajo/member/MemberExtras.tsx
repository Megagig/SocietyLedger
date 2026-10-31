'use client';

import { useState } from 'react';
import { Button, Modal, NativeSelect, Textarea, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { ajoApi, ajoErrorMessage } from '@/lib/ajo/api';
import { formatMoment, ordinal } from '@/lib/ajo/format';
import { toast } from '@/lib/toast';

/** The messages sent to a member when a payment was confirmed (THM2 "receipts"), in the words they were sent. */
export function ReceiptsDialog({ contributionId, onClose }: { contributionId: number | null; onClose: () => void }) {
  const receipts = useQuery({ queryKey: ['ajo', 'receipts', contributionId], queryFn: () => ajoApi.receipts(contributionId ?? 0), enabled: contributionId !== null });
  return (
    <Modal opened={contributionId !== null} onClose={onClose} title="Receipt" centered>
      {receipts.isLoading ? <AjoLoading rows={1} /> : receipts.isError ? <AjoError error={receipts.error} onRetry={() => receipts.refetch()} /> : receipts.data && receipts.data.length > 0 ? (
        <ul className="space-y-3">
          {receipts.data.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="whitespace-pre-line text-ink">{r.message}</p>
              <p className="mt-2 text-xs text-ink-faint">
                {r.sentAt ? `Sent ${formatMoment(r.sentAt)}` : r.queuedForCredits ? 'Waiting to be sent: the group has run out of text credits, and it goes out when they are topped up.' : r.state === 'FAILED' ? 'We could not send this one. The record above is still correct.' : 'Waiting to be sent.'}
              </p>
            </li>
          ))}
        </ul>
      ) : <AjoEmpty title="No receipt yet." hint="A receipt is made when an officer confirms the payment." />}
    </Modal>
  );
}

/** Confirm a phone number with the code sent by text, for a group that asks for it. */
export function PhoneConfirmCard({ membershipId }: { membershipId: number }) {
  const client = useQueryClient();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null);

  const send = async () => {
    setBusy('send');
    setProblem(null);
    try {
      setSentTo((await ajoApi.sendPhoneCode(membershipId)).sentTo);
      toast.success('A code was sent by text.');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not send the code.'));
    } finally {
      setBusy(null);
    }
  };
  const confirm = async () => {
    if (!/^\d{4,8}$/.test(code.trim())) return setProblem('Enter the code from the text message (digits only).');
    setBusy('confirm');
    setProblem(null);
    try {
      const done = await ajoApi.confirmPhoneCode(membershipId, code.trim());
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(done.activation.activated ? 'Phone confirmed. You are in.' : 'Phone confirmed.');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'That code did not work.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Confirm your phone" className="space-y-3 rounded-lg border border-warning-line bg-warning-soft p-4">
      <h2 className="font-semibold text-warning-strong">Confirm your phone number</h2>
      <p className="text-sm text-warning-strong">This circle asks everyone to confirm their phone. We text a code to the number on file.</p>
      {sentTo && <p className="text-sm">Code sent to <strong>{sentTo}</strong>. It stays valid for a short time.</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Button variant={sentTo ? 'default' : 'filled'} color="green" onClick={send} loading={busy === 'send'}>{sentTo ? 'Send a new code' : 'Send me a code'}</Button>
        {sentTo && (
          <>
            <TextInput aria-label="Code" placeholder="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.currentTarget.value)} className="w-32" />
            <Button color="green" onClick={confirm} loading={busy === 'confirm'}>Confirm</Button>
          </>
        )}
      </div>
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    </section>
  );
}

/** A rotating-pot member asks to swap places with someone else, before the first payout. An admin decides. */
export function SwapRequestCard({ groupId }: { groupId: number }) {
  const client = useQueryClient();
  const order = useQuery({ queryKey: ['ajo', 'order', groupId], queryFn: () => ajoApi.order(groupId), retry: false });
  const [other, setOther] = useState('');
  const [mine, setMine] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (order.isLoading || order.isError || !order.data?.drawn) return null;
  const slots = order.data.slots;
  const mySlots = slots.filter((s) => s.mine);
  if (mySlots.length === 0) return null;
  const chosenMine = mine || String(mySlots[0].slotId);
  const nobodyPaid = slots.every((s) => !s.paid);

  const submit = async () => {
    if (!other) return setProblem('Choose the place you want to swap with.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoApi.requestSwap(groupId, { slotAId: Number(chosenMine), slotBId: Number(other), reason: reason.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Your request was sent. An admin will decide.');
      setOther('');
      setReason('');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not send your request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-line p-4">
      <h2 className="text-lg font-semibold">Your place in the order</h2>
      <p className="text-sm text-ink-soft">You collect {mySlots.map((s) => ordinal(s.position)).join(' and ')}. {nobodyPaid ? 'Until the first payout you can ask to swap with someone; an admin decides.' : 'The first payout has been made, so places can no longer be swapped. In a real emergency, speak to an admin.'}</p>
      {nobodyPaid && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {mySlots.length > 1 && <NativeSelect label="Your place" data={mySlots.map((s) => ({ value: String(s.slotId), label: ordinal(s.position) }))} value={chosenMine} onChange={(e) => setMine(e.currentTarget.value)} />}
            <NativeSelect label="Swap with" data={[{ value: '', label: 'Choose…' }, ...slots.filter((s) => !s.mine).map((s) => ({ value: String(s.slotId), label: `${ordinal(s.position)} · ${s.name}` }))]} value={other} onChange={(e) => setOther(e.currentTarget.value)} />
          </div>
          <Textarea label="Why (optional)" autosize minRows={1} maxLength={300} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <Button variant="default" onClick={submit} loading={busy}>Ask to swap</Button>
        </>
      )}
    </section>
  );
}

/** Leaving a group. What they have paid stays on the record; this only stops them taking part. */
export function LeaveGroup({ membershipId, groupName, onLeft }: { membershipId: number; groupName: string; onLeft: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="border-t border-line pt-6">
        <Button variant="subtle" color="red" size="sm" onClick={() => setOpen(true)}>Leave this circle</Button>
      </div>
      <ActionDialog opened={open} onClose={() => setOpen(false)} title={`Leave ${groupName}?`} color="red" confirmLabel="Leave the circle" reasonMin={5} reasonLabel="Why are you leaving? (the officers see this)" successMessage="You have left the circle."
        summary="You stop taking part. Everything you have already paid stays on the record, and anything the circle owes you or you owe it is settled by the officers, not lost."
        onConfirm={async ({ reason }) => { await ajoApi.leave(membershipId, reason); onLeft(); }} />
    </>
  );
}
