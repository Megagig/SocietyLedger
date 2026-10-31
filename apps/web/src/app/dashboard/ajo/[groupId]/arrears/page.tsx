'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, NativeSelect, Tabs, TextInput } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, formatMoment } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { CaseDTO, StaffDisputeDTO, StaffLateFeeDTO } from '@/lib/ajo/staffTypes';
import { useAjoAction, useCase, useGroupCases, useGroupDetail, useGroupDisputes, useLateFees, usePeople } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

const CASE_STATUS: Record<CaseDTO['status'], string> = { OPEN: 'Open', PLAN_AGREED: 'Plan agreed', RESOLVED: 'Resolved', CLOSED_UNRESOLVED: 'Closed, not resolved' };

function CaseDetail({ caseId, canManage, canClose, canWrite, onClose }: { caseId: number | null; canManage: boolean; canClose: boolean; canWrite: boolean; onClose: () => void }) {
  const detail = useCase(caseId ?? 0);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [agreeing, setAgreeing] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState<'RESOLVED' | 'CLOSED_UNRESOLVED'>('RESOLVED');
  const addNote = useAjoAction((text: string) => ajoStaffApi.addCaseNote(caseId ?? 0, text));
  const draft = useAjoAction<void>(() => ajoStaffApi.draftPlan(caseId ?? 0));
  const c = detail.data;
  const open = c ? c.status === 'OPEN' || c.status === 'PLAN_AGREED' : false;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setProblem(null);
    try { await fn(); toast.success(success); } catch (error) { setProblem(ajoErrorMessage(error)); }
  };

  return (
    <Modal opened={caseId !== null} onClose={onClose} title={c ? `Case: ${c.member}` : 'Case'} centered size="lg">
      {detail.isLoading ? <AjoLoading rows={2} /> : detail.isError ? <AjoError error={detail.error} /> : c ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2"><StatusBadge status={c.status === 'OPEN' ? 'PENDING' : c.status === 'PLAN_AGREED' ? 'DUE' : c.status === 'RESOLVED' ? 'CONFIRMED' : 'REVERSED'} label={CASE_STATUS[c.status]} /><span className="text-xs text-ink-faint">opened {formatMoment(c.openedAt)}</span></div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-faint">Owed when it opened</dt><dd className="font-semibold"><Money kobo={c.outstandingAtOpeningKobo} /></dd></div>
            <div><dt className="text-ink-faint">Owed now</dt><dd className="font-semibold"><Money kobo={c.outstandingNowKobo} /></dd></div>
          </dl>
          {c.memberResponse && <p className="rounded-md bg-surface-muted p-3 text-sm"><strong>The member says:</strong> {c.memberResponse}</p>}
          {c.resolution && <p className="text-sm"><strong>Outcome:</strong> {c.resolution}</p>}

          <section className="space-y-2">
            <h3 className="font-semibold">Repayment plans</h3>
            {c.plans.length === 0 ? <p className="text-sm text-ink-faint">No plan has been offered.</p> : c.plans.map((p) => (
              <div key={p.id} className="rounded-md border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{p.status === 'PROPOSED' ? 'Offered, not agreed yet' : p.status === 'ACTIVE' ? `Agreed ${p.agreedAt ? formatMoment(p.agreedAt) : ''}${p.agreedVia ? ` (${p.agreedVia})` : ''}` : p.status === 'COMPLETED' ? 'Paid in full' : `Cancelled${p.cancelReason ? `: ${p.cancelReason}` : ''}`}</span>
                  <span className="space-x-1">{canWrite && canManage && p.status === 'PROPOSED' && <Button size="compact-xs" color="green" onClick={() => setAgreeing(p.id)}>Record agreement</Button>}{canWrite && canManage && (p.status === 'PROPOSED' || p.status === 'ACTIVE') && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setCancelling(p.id)}>Cancel</Button>}</span>
                </div>
                <ul className="mt-2 grid gap-1 text-xs text-ink-muted sm:grid-cols-2">{p.schedule.map((l) => <li key={l.dueDate}>{formatDay(l.dueDate)}: {formatKobo(l.amountKobo)}</li>)}</ul>
              </div>
            ))}
            {canWrite && canManage && open && <Button size="compact-xs" variant="light" onClick={() => run(() => draft.mutateAsync(), 'A plan was drafted and offered to the member.')} loading={draft.isPending}>Draft a new plan</Button>}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">The file</h3>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">{(c.events ?? []).map((e) => <li key={e.id}><span className="text-xs text-ink-faint">{formatMoment(e.createdAt)}</span> · {e.note ?? e.kind}</li>)}</ul>
            {canWrite && canManage && open && (
              <div className="flex gap-2"><TextInput className="flex-1" placeholder="Add a note to the file" value={note} onChange={(e) => setNote(e.currentTarget.value)} /><Button variant="default" onClick={() => run(async () => { await addNote.mutateAsync(note); setNote(''); }, 'Note added.')}>Add</Button></div>
            )}
          </section>
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          {canWrite && canClose && open && <div className="flex justify-end"><Button color="red" variant="light" onClick={() => setClosing(true)}>Close this case</Button></div>}

          <ActionDialog opened={agreeing !== null} onClose={() => setAgreeing(null)} title="Record the member's agreement" confirmLabel="Record agreement" reasonMin={5} reasonLabel="How they agreed (for example, by phone on 5 March)" successMessage="The plan is agreed."
            summary="A plan is a promise about timing. While it is kept, no new late fees land on what it covers." onConfirm={({ reason }) => ajoStaffApi.agreePlan(agreeing ?? 0, reason)} />
          <ActionDialog opened={cancelling !== null} onClose={() => setCancelling(null)} title="Cancel this plan" color="red" confirmLabel="Cancel the plan" reasonMin={10} reasonLabel="Why" successMessage="The plan was cancelled."
            summary="With no plan standing, late fees on the covered payments start again." onConfirm={({ reason }) => ajoStaffApi.cancelPlan(cancelling ?? 0, reason)} />
          <ActionDialog opened={closing} onClose={() => setClosing(false)} title="Close this case" color="red" confirmLabel="Close the case" reasonMin={10} reasonLabel="The outcome, in words (it stays on the record)" needPassword successMessage="The case is closed."
            summary="Closing records how the circle decided to end it. Nothing is taken from anyone, and the member stays in the circle."
            extra={<NativeSelect label="Outcome" data={[{ value: 'RESOLVED', label: 'Resolved' }, { value: 'CLOSED_UNRESOLVED', label: 'Closed, not resolved' }]} value={outcome} onChange={(e) => setOutcome(e.currentTarget.value as typeof outcome)} />}
            onConfirm={({ reason, password }) => ajoStaffApi.closeCase(c.id, { password, outcome, reason })} />
        </div>
      ) : null}
    </Modal>
  );
}

/** THO6: everything about people who are behind: late fees, claims that they already paid, and cases after a payout. */
export default function ArrearsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage, reconcile, approvePayout } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const people = usePeople(groupId);
  const names = new Map((people.data ?? []).map((p) => [p.membershipId, p.name]));
  const nameOf = (id: number) => names.get(id) ?? 'A member';
  // Each role reads only what the server lets it: fees and claims need manage or reconcile, cases need manage or approve. A call it may not make is never sent.
  const canFees = manage || reconcile;
  const canCases = group?.model === 'ROTATING_POT' && (manage || approvePayout);
  const fees = useLateFees(canFees ? groupId : 0);
  const disputes = useGroupDisputes(canFees ? groupId : 0);
  const cases = useGroupCases(canCases ? groupId : 0);
  const [waiving, setWaiving] = useState<StaffLateFeeDTO | null>(null);
  const [unwaiving, setUnwaiving] = useState<StaffLateFeeDTO | null>(null);
  const [told, setTold] = useState<StaffLateFeeDTO | null>(null);
  const [resolving, setResolving] = useState<StaffDisputeDTO | null>(null);
  const [outcome, setOutcome] = useState<'UPHELD' | 'NOT_UPHELD'>('UPHELD');
  const [openCaseId, setOpenCaseId] = useState<number | null>(null);
  const [newCaseFor, setNewCaseFor] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const openCase = useAjoAction((membershipId: number) => ajoStaffApi.openCase(membershipId));
  const anyOfficer = manage || reconcile;
  const rotating = group?.model === 'ROTATING_POT';

  const evidence = async (id: number) => {
    try { window.open((await ajoStaffApi.disputeEvidence(id)).url, '_blank', 'noopener,noreferrer'); } catch (error) { setProblem(ajoErrorMessage(error, 'Could not open the evidence.')); }
  };

  return (
    <div className="space-y-4">
      {problem && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-text">{problem}</p>}
      <Tabs defaultValue={canFees ? 'fees' : 'cases'} keepMounted={false}>
        <Tabs.List>
          {canFees && <Tabs.Tab value="fees">Late fees</Tabs.Tab>}
          {canFees && <Tabs.Tab value="disputes">Claims of &quot;I paid&quot;{disputes.data && disputes.data.filter((d) => d.status === 'OPEN').length ? ` (${disputes.data.filter((d) => d.status === 'OPEN').length})` : ''}</Tabs.Tab>}
          {canCases && <Tabs.Tab value="cases">Default cases</Tabs.Tab>}
        </Tabs.List>

        {canFees && <Tabs.Panel value="fees" pt="md" className="space-y-3">
          <p className="max-w-3xl text-sm text-ink-muted">A late fee is worked out from the rules the member accepted. They are told first, and it only becomes payable 48 hours later. It belongs to the circle, never to a payout or to SocietyLedger.</p>
          {fees.isLoading ? <AjoLoading /> : fees.isError ? <AjoError error={fees.error} onRetry={() => fees.refetch()} /> : fees.data && fees.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted"><tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 text-right font-medium">Fee</th><th className="px-4 py-2 font-medium">How it was worked out</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
              <tbody>{fees.data.map((f) => (
                <tr key={f.id} className="border-t border-line-soft align-top">
                  <td className="px-4 py-3 font-medium">{nameOf(f.membershipId)}</td><td className="px-4 py-3 text-right"><Money kobo={f.feeKobo} /></td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{f.calculation?.text}{f.waivedReason ? ` · waived: ${f.waivedReason}` : ''}{f.status === 'PENDING' && !f.notifiedAt ? ' · the member has not been told yet' : ''}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {canWrite && manage && f.status === 'PENDING' && !f.notifiedAt && <Button size="compact-xs" variant="subtle" onClick={() => setTold(f)}>I told them</Button>}
                    {canWrite && manage && (f.status === 'PENDING' || f.status === 'PAYABLE') && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setWaiving(f)}>Waive</Button>}
                    {canWrite && manage && f.status === 'WAIVED' && <Button size="compact-xs" variant="subtle" onClick={() => setUnwaiving(f)}>Undo waiver</Button>}
                  </td>
                </tr>))}</tbody></table></div>
          ) : <AjoEmpty title="No late fees." hint="Fees only appear if the circle's rules have a late fee and someone is late past the grace days." />}
        </Tabs.Panel>}

        {canFees && <Tabs.Panel value="disputes" pt="md" className="space-y-3">
          <p className="max-w-3xl text-sm text-ink-muted">While a claim is open, that member is not charged late fees or chased. A different person from the one who raised it decides, with a reason. A decision is final, and a claim never creates money: record the payment the normal way if it was real.</p>
          {disputes.isLoading ? <AjoLoading /> : disputes.isError ? <AjoError error={disputes.error} onRetry={() => disputes.refetch()} /> : disputes.data && disputes.data.length > 0 ? (
            <ul className="divide-y divide-line-soft rounded-lg border border-line">{disputes.data.map((d) => (
              <li key={d.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{nameOf(d.membershipId)} <span className="text-xs font-normal text-ink-faint">· {formatMoment(d.createdAt)}</span></p><StatusBadge status={d.outcome === 'OPEN' ? 'PENDING' : d.outcome} label={d.outcome === 'OPEN' ? 'Waiting for a decision' : undefined} /></div>
                <p className="text-sm text-ink-soft">{d.claim}</p>
                {d.resolution && <p className="text-xs text-ink-faint">Decision: {d.resolution}</p>}
                <div className="space-x-1">{d.hasEvidence && <Button size="compact-xs" variant="subtle" onClick={() => evidence(d.id)}>See evidence</Button>}{canWrite && anyOfficer && d.status === 'OPEN' && <Button size="compact-xs" color="green" onClick={() => { setResolving(d); setOutcome('UPHELD'); }}>Decide</Button>}</div>
              </li>))}</ul>
          ) : <AjoEmpty title="No claims." />}
        </Tabs.Panel>}

        {canCases && (
          <Tabs.Panel value="cases" pt="md" className="space-y-3">
            <p className="max-w-3xl text-sm text-ink-muted">A case opens when someone who has already collected stops paying. It keeps a record and can offer a repayment plan. Nothing is taken from other members or guarantors, and nobody is removed automatically.</p>
            {canWrite && manage && (
              <div className="flex flex-wrap items-end gap-2"><NativeSelect label="Open a case by hand" data={[{ value: '', label: 'Choose a person…' }, ...(people.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => ({ value: String(p.membershipId), label: p.name }))]} value={newCaseFor} onChange={(e) => setNewCaseFor(e.currentTarget.value)} /><Button variant="default" disabled={!newCaseFor} onClick={async () => { setProblem(null); try { await openCase.mutateAsync(Number(newCaseFor)); toast.success('Case opened.'); setNewCaseFor(''); } catch (e) { setProblem(ajoErrorMessage(e)); } }} loading={openCase.isPending}>Open case</Button></div>
            )}
            {cases.isLoading ? <AjoLoading /> : cases.isError ? <AjoError error={cases.error} onRetry={() => cases.refetch()} /> : cases.data && cases.data.length > 0 ? (
              <ul className="divide-y divide-line-soft rounded-lg border border-line">{cases.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div><p className="font-medium">{c.member}</p><p className="text-xs text-ink-faint">Owes <Money kobo={c.outstandingNowKobo} /> now · opened {formatDay(c.openedAt)}</p></div><div className="flex items-center gap-2"><StatusBadge status={c.status === 'OPEN' ? 'PENDING' : c.status === 'PLAN_AGREED' ? 'DUE' : c.status === 'RESOLVED' ? 'CONFIRMED' : 'REVERSED'} label={CASE_STATUS[c.status]} /><Button size="compact-xs" variant="light" onClick={() => setOpenCaseId(c.id)}>Open</Button></div></li>))}</ul>
            ) : <AjoEmpty title="No cases." />}
          </Tabs.Panel>
        )}
      </Tabs>

      <ActionDialog opened={waiving !== null} onClose={() => setWaiving(null)} title="Waive this late fee" color="red" confirmLabel="Waive the fee" reasonMin={10} reasonLabel="Why (it stays on the record)" successMessage="The fee was waived."
        summary={waiving ? `${nameOf(waiving.membershipId)}'s late fee of ${formatKobo(waiving.feeKobo)} will never be counted or charged. You can undo a waiver later, with a reason.` : null} onConfirm={({ reason }) => ajoStaffApi.waiveFee(waiving?.id ?? 0, reason)} />
      <ActionDialog opened={unwaiving !== null} onClose={() => setUnwaiving(null)} title="Undo this waiver" confirmLabel="Undo the waiver" reasonMin={10} reasonLabel="Why" successMessage="The waiver was undone."
        summary={unwaiving ? `${nameOf(unwaiving.membershipId)}'s late fee of ${formatKobo(unwaiving.feeKobo)} applies again.` : null} onConfirm={({ reason }) => ajoStaffApi.reverseWaiver(unwaiving?.id ?? 0, reason)} />
      <ActionDialog opened={told !== null} onClose={() => setTold(null)} title="Record that you told them" confirmLabel="Record it" reasonMin={5} reasonLabel="How you told them (for example, in person at the market)" successMessage="Recorded. The fee becomes payable after 48 hours."
        summary={told ? `Use this only when ${nameOf(told.membershipId)} could not be reached by the app or a text, and you told them yourself.` : null} onConfirm={({ reason }) => ajoStaffApi.feeTold(told?.id ?? 0, reason)} />
      <ActionDialog opened={resolving !== null} onClose={() => setResolving(null)} title="Decide this claim" confirmLabel="Record the decision" reasonMin={10} reasonLabel="Your reason (the member is told)" successMessage="Decided. The member has been told."
        summary={resolving ? <>{nameOf(resolving.membershipId)} says: “{resolving.claim}”. The decision cannot be changed afterwards.</> : null}
        extra={<NativeSelect label="Decision" data={[{ value: 'UPHELD', label: 'Accept the claim' }, { value: 'NOT_UPHELD', label: 'Do not accept the claim' }]} value={outcome} onChange={(e) => setOutcome(e.currentTarget.value as typeof outcome)} />}
        onConfirm={({ reason }) => ajoStaffApi.resolveDispute(resolving?.id ?? 0, { outcome, reason })} />
      <CaseDetail caseId={openCaseId} canManage={manage} canClose={approvePayout} canWrite={canWrite} onClose={() => setOpenCaseId(null)} />
    </div>
  );
}
