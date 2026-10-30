'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, FileInput, Modal, NativeSelect, Textarea, TextInput } from '@mantine/core';
import { validateProof } from '@/components/ajo/proof';
import { ajoApi, ajoErrorMessage } from '@/lib/ajo/api';
import { nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useGroups, usePeople } from '@/lib/ajo/staffHooks';
import { toast } from '@/lib/toast';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * An officer records a payment a member made but never reported. Someone who can confirm sees it confirmed in the same step (they have
 * seen it at the bank): the bank reference and how they checked it are required, and it is marked as recorded by an officer. Someone who
 * can only manage records it as reported, and a person who can confirm finishes it.
 */
export function RecordPaymentDialog({ opened, onClose, canConfirm, defaultGroupId }: { opened: boolean; onClose: () => void; canConfirm: boolean; defaultGroupId?: number }) {
  const client = useQueryClient();
  const groups = useGroups();
  const running = (groups.data ?? []).filter((g) => g.status === 'ACTIVE');
  const [groupId, setGroupId] = useState('');
  const people = usePeople(Number(groupId) || 0);
  const [membershipId, setMembershipId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(newKey());

  useEffect(() => {
    if (!opened) return;
    setGroupId(defaultGroupId ? String(defaultGroupId) : running.length === 1 ? String(running[0].id) : '');
    setMembershipId('');
    setAmount('');
    setPaidOn('');
    setReference('');
    setNote('');
    setProof(null);
    setProblem(null);
    keyRef.current = newKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, defaultGroupId]);

  const active = (people.data ?? []).filter((p) => p.status === 'ACTIVE');

  const submit = async () => {
    const kobo = nairaToKobo(amount);
    if (!groupId) return setProblem('Choose the circle.');
    if (!membershipId) return setProblem('Choose the person.');
    if (kobo === null || kobo <= BigInt(0)) return setProblem('Enter the amount, in naira.');
    if (canConfirm && reference.trim().length < 3) return setProblem('Give the bank reference, so the payment can be found on the statement.');
    if (canConfirm && note.trim().length < 5) return setProblem('Say how you checked it, for example “seen in the 14 Nov statement”.');
    if (!canConfirm && !proof && reference.trim().length < 3) return setProblem('Attach the slip, or give the bank reference.');
    if (proof) {
      const bad = validateProof(proof);
      if (bad) return setProblem(bad);
    }
    setBusy(true);
    setProblem(null);
    try {
      const base = { membershipId: Number(membershipId), amountKobo: kobo, paidOn: paidOn || undefined, proof, idempotencyKey: keyRef.current };
      if (canConfirm) await ajoStaffApi.recordReceived(Number(groupId), { ...base, bankReference: reference.trim(), note: note.trim() });
      else await ajoApi.reportTransfer(Number(groupId), { ...base, bankReference: reference.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(canConfirm ? 'Recorded and confirmed. The member has been told.' : 'Recorded. A person who can confirm will finish it.');
      onClose();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Record a payment" centered size="lg">
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          For a member who paid but did not report it.{' '}
          {canConfirm ? 'Record it only after you have seen it at the bank. It is confirmed in the same step, and the member is told it was recorded by an officer.' : 'It is recorded as reported, and a person who can confirm checks it against the bank statement.'}
        </p>
        <NativeSelect label="Circle" data={[{ value: '', label: 'Choose a circle…' }, ...running.map((g) => ({ value: String(g.id), label: g.name }))]} value={groupId} onChange={(e) => { setGroupId(e.currentTarget.value); setMembershipId(''); }} />
        <NativeSelect label="Person" data={[{ value: '', label: groupId ? 'Choose a person…' : 'Choose a circle first' }, ...active.map((p) => ({ value: String(p.membershipId), label: p.name }))]} value={membershipId} onChange={(e) => setMembershipId(e.currentTarget.value)} disabled={!groupId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Amount (₦)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />
          <TextInput label="Date paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.currentTarget.value)} />
        </div>
        <TextInput label={canConfirm ? 'Bank reference' : 'Bank reference (or attach the slip)'} value={reference} onChange={(e) => setReference(e.currentTarget.value)} description="As it appears on the circle's bank statement." />
        {canConfirm && <Textarea label="How you checked it" description="For example “seen in the 14 Nov statement”. The admin can see this." autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />}
        <FileInput label="Slip or receipt (optional)" accept="image/jpeg,image/png,image/webp,application/pdf" value={proof} onChange={setProof} clearable description="JPG, PNG, WebP or PDF, up to 5 MB." />
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="green" onClick={submit} loading={busy}>
            {canConfirm ? 'Record and confirm' : 'Record'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
