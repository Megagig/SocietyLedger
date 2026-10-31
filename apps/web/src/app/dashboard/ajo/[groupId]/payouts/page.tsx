'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Checkbox, FileInput, Modal, NativeSelect, PasswordInput, TextInput, Textarea } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { validateProof } from '@/components/ajo/proof';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { formatKobo, formatMoment, koboPositive, ordinal } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { PayoutDTO, PrepareAllResult } from '@/lib/ajo/staffTypes';
import { useAjoAction, useGroupDetail, usePayouts, usePeople } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

const STATUS_LABEL: Record<string, string> = { PREPARED: 'Waiting for approval', APPROVED: 'Approved, waiting to be paid', PAID: 'Paid', VOID: 'Cancelled', REVERSED: 'Reversed' };

/** The highest-risk step: the password is typed again and the person sees exactly who is paid, how much and to which account. */
function ApproveDialog({ payout, onClose }: { payout: PayoutDTO | null; onClose: () => void }) {
  const client = useQueryClient();
  const [password, setPassword] = useState('');
  const [self, setSelf] = useState(false);
  const [note, setNote] = useState('');
  const [needsSelf, setNeedsSelf] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setPassword(''); setSelf(false); setNote(''); setNeedsSelf(null); setProblem(null); setBusy(false); onClose(); };

  const submit = async () => {
    if (!payout) return;
    if (!password) return setProblem('Enter your password to approve this.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.approvePayout(payout.id, { password, confirmSelfApproval: self || undefined, note: note.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Approved. An officer can now pay it and record the bank reference.');
      close();
    } catch (error) {
      setBusy(false);
      const code = ajoErrorCode(error);
      if (code === 'SELF_APPROVAL_NEEDS_CONFIRMATION') setNeedsSelf(ajoErrorMessage(error));
      else {
        setProblem(ajoErrorMessage(error));
        if (code === 'REAUTH_FAILED') setPassword('');
      }
    }
  };

  return (
    <Modal opened={payout !== null} onClose={close} title="Approve this payout" centered closeOnClickOutside={!busy}>
      {payout && (
        <div className="space-y-4">
          <dl className="space-y-1 rounded-md bg-surface-muted p-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-faint">Pay</dt><dd className="font-medium">{payout.recipient}{payout.round ? ` · round ${payout.round}` : ''}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-faint">Amount</dt><dd className="text-lg font-semibold"><Money kobo={payout.netKobo} /></dd></div>
            <div className="flex justify-between"><dt className="text-ink-faint">To account</dt><dd className="font-medium">{payout.account.bankName} · {payout.account.accountName} · <span className="font-mono">{payout.account.masked}</span></dd></div>
            {koboPositive(payout.shortfallKobo) && <div className="flex justify-between text-danger"><dt>Short by</dt><dd><Money kobo={payout.shortfallKobo} /></dd></div>}
          </dl>
          <p className="text-xs text-ink-faint">Approving does not send any money. After approval an officer pays it from the circle&apos;s own bank account and records the bank reference.</p>
          {needsSelf && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needsSelf}</p>
              <Checkbox label="I am the only admin, and I checked this myself." checked={self} onChange={(e) => setSelf(e.currentTarget.checked)} />
              <Textarea label="Note" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </div>
          )}
          <PasswordInput label="Your password" description="Typed again to be sure it is you." autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={close} disabled={busy}>Cancel</Button><Button color="green" onClick={submit} loading={busy} disabled={needsSelf !== null && (!self || note.trim().length < 5)}>Approve payout</Button></div>
        </div>
      )}
    </Modal>
  );
}

/** Recording that the circle has paid: the bank reference, and the slip if there is one. SocietyLedger sends no money. */
function RecordPaidDialog({ payout, onClose }: { payout: PayoutDTO | null; onClose: () => void }) {
  const client = useQueryClient();
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [own, setOwn] = useState(false);
  const [note, setNote] = useState('');
  const [needsOwn, setNeedsOwn] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setReference(''); setProof(null); setOwn(false); setNote(''); setNeedsOwn(null); setProblem(null); setBusy(false); onClose(); };

  const submit = async () => {
    if (!payout) return;
    if (reference.trim().length < 3) return setProblem('Enter the bank reference or transaction number for this transfer.');
    const bad = proof ? validateProof(proof) : null;
    if (bad) return setProblem(bad);
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.recordPayoutPaid(payout.id, { reference: reference.trim(), proof, note: note.trim() || undefined, confirmOwn: own || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Recorded as paid.');
      close();
    } catch (error) {
      setBusy(false);
      const code = ajoErrorCode(error);
      if (code === 'SELF_APPROVAL_NEEDS_CONFIRMATION' || code === 'SELF_CONFIRM_NEEDS_NOTE') setNeedsOwn(ajoErrorMessage(error));
      else setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={payout !== null} onClose={close} title="Record that this was paid" centered>
      {payout && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Record this only after you have sent <strong><Money kobo={payout.netKobo} /></strong> to <strong>{payout.recipient}</strong> ({payout.account.bankName} {payout.account.masked}) from the circle&apos;s account.</p>
          <TextInput label="Bank reference" value={reference} onChange={(e) => setReference(e.currentTarget.value)} maxLength={120} />
          <FileInput label="Slip (optional)" accept="image/jpeg,image/png,image/webp,application/pdf" value={proof} onChange={setProof} clearable />
          {needsOwn && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needsOwn}</p>
              <Checkbox label="I am the only person who can record this, and I paid it myself." checked={own} onChange={(e) => setOwn(e.currentTarget.checked)} />
              <Textarea label="Note" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </div>
          )}
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={close} disabled={busy}>Cancel</Button><Button color="green" onClick={submit} loading={busy} disabled={needsOwn !== null && (!own || note.trim().length < 5)}>Record as paid</Button></div>
        </div>
      )}
    </Modal>
  );
}

/** THO5: prepare a payout from the confirmed money (and see any shortfall), have an admin approve it, then record that it was paid. */
export default function PayoutsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage, reconcile, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const payouts = usePayouts(groupId);
  const people = usePeople(groupId);
  const rotating = group?.model === 'ROTATING_POT';
  const [round, setRound] = useState('');
  const [person, setPerson] = useState('');
  const target = rotating ? (round ? { round: Number(round) } : null) : person ? { membershipId: Number(person) } : null;
  const preview = useQuery({ queryKey: ['ajo', 'staff', 'preview', groupId, JSON.stringify(target)], queryFn: () => ajoStaffApi.payoutPreview(groupId, target ?? {}), enabled: !!target && manage, retry: false });
  const prepare = useAjoAction((body: { round?: number; membershipId?: number }) => ajoStaffApi.preparePayout(groupId, body));
  const complete = useAjoAction<void>(() => ajoStaffApi.completeGroup(groupId));
  const prepareAll = useAjoAction<void>(() => ajoStaffApi.prepareAllPayouts(groupId).then((r) => setAllResult(r)));
  const [allResult, setAllResult] = useState<PrepareAllResult | null>(null);
  const [approving, setApproving] = useState<PayoutDTO | null>(null);
  const [paying, setPaying] = useState<PayoutDTO | null>(null);
  const [voiding, setVoiding] = useState<PayoutDTO | null>(null);
  const [failing, setFailing] = useState<PayoutDTO | null>(null);
  const [reversing, setReversing] = useState<PayoutDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const active = (people.data ?? []).filter((p) => p.status === 'ACTIVE');

  const doPrepare = async () => {
    if (!target) return;
    setProblem(null);
    try {
      await prepare.mutateAsync(target);
      toast.success('Payout prepared. An admin can now approve it.');
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-muted">SocietyLedger never sends money. A payout is worked out from the confirmed contributions, approved by an admin, paid by your circle from its own account, and then recorded here with the bank reference.</p>
      {problem && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-text">{problem}</p>}

      {manage && canWrite && group?.status === 'ACTIVE' && (
        <section className="space-y-4 rounded-lg border border-line p-5">
          <h2 className="font-semibold">Prepare a payout</h2>
          {rotating ? (
            <NativeSelect label="Round" data={[{ value: '', label: 'Choose a round…' }, ...Array.from({ length: group.rounds ?? 0 }, (_, i) => ({ value: String(i + 1), label: `Round ${i + 1}` }))]} value={round} onChange={(e) => setRound(e.currentTarget.value)} />
          ) : (
            <NativeSelect label="Person" data={[{ value: '', label: 'Choose a person…' }, ...active.map((p) => ({ value: String(p.membershipId), label: p.name }))]} value={person} onChange={(e) => setPerson(e.currentTarget.value)} />
          )}
          {target && preview.isLoading && <AjoLoading rows={1} />}
          {target && preview.isError && <AjoError error={preview.error} />}
          {preview.data && target && (
            <div className="space-y-3 rounded-md bg-surface-muted p-4 text-sm">
              <p className="font-medium">{preview.data.recipient}{preview.data.round ? ` collects round ${preview.data.round}` : ''}</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="flex justify-between"><dt className="text-ink-faint">Scheduled</dt><dd><Money kobo={preview.data.grossKobo} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Confirmed so far</dt><dd><Money kobo={preview.data.confirmedKobo} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Collector fee</dt><dd><Money kobo={preview.data.totalFeeKobo} /></dd></div>
                <div className="flex justify-between font-semibold"><dt>To pay out</dt><dd><Money kobo={preview.data.netKobo} /></dd></div>
              </dl>
              {koboPositive(preview.data.shortfallKobo) && (
                <div className="rounded-md bg-warning-soft p-3 text-warning-strong">
                  <p className="font-medium">Short by <Money kobo={preview.data.shortfallKobo} /></p>
                  <ul className="mt-1 list-disc pl-5">{preview.data.shortfall.map((s) => <li key={s.membershipId}>{s.name}: {formatKobo(s.shortKobo)}</li>)}</ul>
                  <p className="mt-1 text-xs">You can still pay out what has been confirmed. Money that arrives later is paid as a second payout.</p>
                </div>
              )}
              {preview.data.recipientArrearsNote && <p className="text-xs text-ink-muted">{preview.data.recipientArrearsNote}</p>}
              {!preview.data.readiness.ok && <p className="text-danger">{preview.data.readiness.message ?? 'This round is not ready yet.'}</p>}
              {!preview.data.eligibility.ok && <p className="text-danger">{preview.data.eligibility.message ?? 'This person cannot be paid out yet.'}</p>}
              {preview.data.openPayoutId && <p className="text-ink-muted">There is already an open payout for this.</p>}
              <Button color="green" onClick={doPrepare} loading={prepare.isPending} disabled={!preview.data.canPrepare}>Prepare this payout</Button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Payouts</h2>
        {payouts.isLoading ? <AjoLoading /> : payouts.isError ? <AjoError error={payouts.error} onRetry={() => payouts.refetch()} /> : payouts.data && payouts.data.length > 0 ? (
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {payouts.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{p.recipient}{p.round ? ` · ${ordinal(p.round)} round` : ''}{p.sequence > 1 ? ` (extra payout ${p.sequence})` : ''} · <Money kobo={p.netKobo} /></p>
                  <p className="text-xs text-ink-faint">{p.account.bankName} · {p.account.masked} · prepared {formatMoment(p.preparedAt)}{p.paidReference ? ` · ref ${p.paidReference}` : ''}{p.voidReason ? ` · ${p.failed ? 'failed' : 'cancelled'}: ${p.voidReason}` : ''}{p.reverseReason ? ` · reversed: ${p.reverseReason}` : ''}{p.selfApprovalConfirmed ? ' · approved by the only admin' : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status === 'PREPARED' ? 'PENDING' : p.status === 'APPROVED' ? 'DUE' : p.status} label={STATUS_LABEL[p.status]} />
                  {canWrite && p.status === 'PREPARED' && approvePayout && <Button size="compact-xs" color="green" onClick={() => setApproving(p)}>Approve</Button>}
                  {canWrite && p.status === 'APPROVED' && reconcile && <><Button size="compact-xs" color="green" onClick={() => setPaying(p)}>Record as paid</Button><Button size="compact-xs" variant="default" onClick={() => setFailing(p)}>Transfer failed</Button></>}
                  {canWrite && (p.status === 'PREPARED' || p.status === 'APPROVED') && (manage || approvePayout) && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setVoiding(p)}>Cancel</Button>}
                  {canWrite && p.status === 'PAID' && approvePayout && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setReversing(p)}>Reverse</Button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <AjoEmpty title="No payouts yet." />}
      </section>

      {manage && canWrite && !rotating && group && (group.status === 'ACTIVE' || group.status === 'COMPLETED') && (
        <section className="space-y-3 rounded-lg border border-line p-5">
          <h2 className="font-semibold">Prepare everyone's payout</h2>
          <p className="text-sm text-ink-muted">At the end of a cycle, prepare a payout for every saver who is ready in one go. Anyone who is not ready (for example no verified payout account) is listed with the reason, and nothing is prepared for them.</p>
          <Button color="green" loading={prepareAll.isPending} onClick={async () => { setProblem(null); try { await prepareAll.mutateAsync(); toast.success('Done. See the list below.'); } catch (error) { setProblem(ajoErrorMessage(error)); } }}>Prepare all ready payouts</Button>
          {allResult && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-ink">{allResult.prepared.length} prepared, {allResult.notReady.length} not ready.</p>
              {allResult.notReady.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                  {allResult.notReady.map((n) => (<li key={n.membershipId}><span className="font-medium">{n.name}</span>: {n.message}</li>))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {approvePayout && canWrite && group?.status === 'ACTIVE' && (
        <section className="rounded-lg border border-line p-5">
          <h2 className="font-semibold">Finish the circle</h2>
          <p className="mt-1 text-sm text-ink-muted">When every payout has been made and nothing is open, close the circle. It stays readable and can still be reported on.</p>
          <Button className="mt-3" variant="default" onClick={async () => { setProblem(null); try { await complete.mutateAsync(); toast.success('The circle is completed.'); } catch (e) { setProblem(ajoErrorMessage(e)); } }} loading={complete.isPending}>Complete the circle</Button>
        </section>
      )}

      <ApproveDialog payout={approving} onClose={() => setApproving(null)} />
      <RecordPaidDialog payout={paying} onClose={() => setPaying(null)} />
      <ActionDialog opened={voiding !== null} onClose={() => setVoiding(null)} title="Cancel this payout" color="red" confirmLabel="Cancel the payout" reasonMin={5} reasonLabel="Why" successMessage="The payout was cancelled. Nothing was paid."
        summary={voiding ? `${voiding.recipient}'s payout of ${formatKobo(voiding.netKobo)} will be cancelled. Nothing has been sent, and a new one can be prepared.` : null} onConfirm={({ reason }) => ajoStaffApi.voidPayout(voiding?.id ?? 0, reason)} />
      <ActionDialog opened={failing !== null} onClose={() => setFailing(null)} title="The transfer failed" color="red" confirmLabel="Record the failure" reasonMin={5} reasonLabel="What happened" successMessage="Recorded. The admins have been told."
        summary={failing ? `The transfer of ${formatKobo(failing.netKobo)} to ${failing.recipient} did not go through. This cancels the payout and tells the admins.` : null} onConfirm={({ reason }) => ajoStaffApi.failPayout(failing?.id ?? 0, reason)} />
      <ActionDialog opened={reversing !== null} onClose={() => setReversing(null)} title="Reverse a paid payout" color="red" confirmLabel="Reverse it" reasonMin={10} reasonLabel="Why is it being reversed" needPassword successMessage="The payout was reversed and the reason recorded."
        summary={reversing ? `${reversing.recipient}'s payout of ${formatKobo(reversing.netKobo)} (reference ${reversing.paidReference ?? 'none'}) will be marked reversed and the round goes back to waiting. Do this only if the money came back to the circle.` : null}
        onConfirm={({ reason, password }) => ajoStaffApi.reversePayout(reversing?.id ?? 0, { reason, password })} />
    </div>
  );
}
