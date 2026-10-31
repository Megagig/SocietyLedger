'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, NumberInput, SegmentedControl, TextInput, Textarea } from '@mantine/core';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { RosterPersonDTO } from '@/lib/ajo/staffTypes';
import { RecordRulesAcceptanceDialog } from '@/components/ajo/RecordRulesAcceptanceDialog';
import { useAjoAction, useGroupDetail, useGroupTrust, useRoster } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

function AddMemberDialog({ groupId, opened, onClose, rotating, maxShares, minAmountKobo }: { groupId: number; opened: boolean; onClose: () => void; rotating: boolean; maxShares: number; minAmountKobo?: string }) {
  const [search, setSearch] = useState('');
  const [shares, setShares] = useState(1);
  // Collector thrift: the amount the saver chose to pay each time. Empty means the group's smallest.
  const [amount, setAmount] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const people = useQuery({ queryKey: ['ajo', 'staff', 'people', search], queryFn: () => ajoStaffApi.searchPeople(search), enabled: opened, placeholderData: keepPreviousData });
  const add = useAjoAction((input: { memberId: number; amountKobo?: string }) => ajoStaffApi.addMember(groupId, input.memberId, rotating ? shares : undefined, input.amountKobo));

  const choose = async (memberId: number, name: string) => {
    setProblem(null);
    let amountKobo: string | undefined;
    if (!rotating && amount.trim()) {
      const kobo = nairaToKobo(amount);
      if (kobo === null) return setProblem('Enter the amount in naira, for example 1,000.');
      amountKobo = kobo.toString();
    }
    try {
      await add.mutateAsync({ memberId, amountKobo });
      toast.success(`${name} was added. They need the circle to approve them.`);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add a person" centered size="lg">
      <div className="space-y-4">
        <TextInput label="Find an association member" placeholder="Name, member number or phone" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        {rotating && <NumberInput label="Shares" description="A person with two shares pays twice each round and collects twice." min={1} max={maxShares} value={shares} onChange={(v) => setShares(typeof v === 'number' ? v : 1)} />}
        {!rotating && <TextInput label="What this person will save each time (₦)" description={`They choose it and keep it for the whole cycle. Leave empty for the smallest (${formatKobo(minAmountKobo)}).`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />}
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        {people.isLoading ? <AjoLoading rows={2} /> : people.isError ? <AjoError error={people.error} /> : people.data && people.data.length > 0 ? (
          <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto rounded-lg border border-line">
            {people.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-ink-faint">{p.memberNumber}{p.phone ? ` · ${p.phone}` : ' · no phone yet'}{p.hasLogin ? '' : ' · no login'}</p></div>
                <Button size="compact-sm" variant="light" onClick={() => choose(p.id, p.name)} loading={add.isPending && add.variables?.memberId === p.id}>Add</Button>
              </li>
            ))}
          </ul>
        ) : <AjoEmpty title="Nobody matches." hint="Only active association members can be added." />}
      </div>
    </Modal>
  );
}

function GuarantorDialog({ person, onClose }: { person: RosterPersonDTO | null; onClose: () => void }) {
  const [mode, setMode] = useState<'link' | 'self'>('link');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [note, setNote] = useState('');
  const [wording, setWording] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAjoAction((body: Parameters<typeof ajoStaffApi.recordGuarantor>[1]) => ajoStaffApi.recordGuarantor(person?.membershipId ?? 0, body));
  const makeLink = useAjoAction((body: { name: string; phone: string; relationship: string }) => ajoStaffApi.guarantorLink(person?.membershipId ?? 0, body));

  const close = () => { setMode('link'); setName(''); setPhone(''); setRelationship(''); setNote(''); setWording(null); setMade(null); setCopied(false); setProblem(null); onClose(); };
  const filled = () => (name.trim().length < 2 ? 'Enter the guarantor’s name.' : phone.trim().length < 7 ? 'Enter the guarantor’s phone number.' : relationship.trim().length < 2 ? 'Say how the guarantor knows the member.' : null);

  const showWording = async () => {
    if (!person || name.trim().length < 2) return setProblem('Enter the guarantor’s name first.');
    setProblem(null);
    try {
      setWording((await ajoStaffApi.guarantorWording(person.membershipId, name.trim())).wording);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  const createLink = async () => {
    const bad = filled();
    if (bad) return setProblem(bad);
    setProblem(null);
    try {
      const r = await makeLink.mutateAsync({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim() });
      setMade({ link: r.link, expiresAt: r.expiresAt });
      setWording(r.wording);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  const copy = async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(made.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error('Could not copy. Select the link and copy it yourself.'); }
  };
  const submit = async () => {
    const bad = filled();
    if (bad) return setProblem(bad);
    if (!wording) return setProblem('Read the wording to the guarantor first, using “Show the wording”.');
    if (note.trim().length < 5) return setProblem('Say how the guarantor agreed (for example “agreed by phone on 5 March”).');
    try {
      await save.mutateAsync({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim(), note: note.trim() });
      toast.success('The guarantor’s agreement was recorded.');
      close();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={person !== null} onClose={close} title={`Guarantor for ${person?.name ?? ''}`} centered size="lg">
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">A guarantor is a recorded agreement only. Nothing is ever taken from them automatically.</p>
        {!made && (
          <SegmentedControl fullWidth value={mode} onChange={(v) => { setMode(v as typeof mode); setProblem(null); }} data={[{ value: 'link', label: 'Send them a link' }, { value: 'self', label: 'I will record it myself' }]} />
        )}
        {made ? (
          <div className="space-y-3">
            <p className="text-sm">Send this link to <strong>{name}</strong>, for example by WhatsApp or text. It works once and expires on {formatDay(made.expiresAt)}. It is shown only now.</p>
            <div className="flex gap-2"><input readOnly aria-label="Link for the guarantor" value={made.link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm" /><Button variant="light" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button></div>
            {wording && <p className="rounded-md bg-surface-muted p-3 text-sm"><span className="font-medium">They will be asked to agree to: </span>{wording}</p>}
            <p className="text-xs text-ink-faint">You are told when they accept, and the member is activated if nothing else is missing. Creating another link replaces this one.</p>
            <div className="flex justify-end"><Button onClick={close}>Done</Button></div>
          </div>
        ) : (
          <>
            <TextInput label="Guarantor’s name" value={name} onChange={(e) => { setName(e.currentTarget.value); setWording(null); }} />
            <TextInput label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <TextInput label="Relationship to the member" value={relationship} onChange={(e) => setRelationship(e.currentTarget.value)} />
            {mode === 'self' && (
              <>
                <Button variant="light" size="xs" onClick={showWording}>Show the wording</Button>
                {wording && <p className="rounded-md bg-surface-muted p-3 text-sm">{wording}</p>}
                <Textarea label="How they agreed" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
              </>
            )}
            {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={close}>Cancel</Button>
              {mode === 'link' ? <Button color="green" onClick={createLink} loading={makeLink.isPending}>Create the link</Button> : <Button color="green" onClick={submit} loading={save.isPending}>Record agreement</Button>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** THO3: the roster with approvals, SocietyLedger verification, rule acceptance, guarantors and shares. */
export default function MembersPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const roster = useRoster(groupId);
  const approve = useAjoAction((membershipId: number) => ajoStaffApi.approveMember(membershipId));
  const setShares = useAjoAction((input: { membershipId: number; shares: number }) => ajoStaffApi.setShares(input.membershipId, input.shares));
  const trust = useGroupTrust(groupId);
  const trustOf = new Map((trust.data ?? []).map((t) => [t.membershipId, t]));
  const recheck = useAjoAction((memberId: number) => ajoStaffApi.resubmitVerification(memberId));
  const [adding, setAdding] = useState(false);
  const [guarantorFor, setGuarantorFor] = useState<RosterPersonDTO | null>(null);
  const [rulesFor, setRulesFor] = useState<RosterPersonDTO | null>(null);
  const [sharesFor, setSharesFor] = useState<RosterPersonDTO | null>(null);
  const [newShares, setNewShares] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const can = manage && canWrite;
  const rotating = group?.model === 'ROTATING_POT';

  const doApprove = async (p: RosterPersonDTO) => {
    setProblem(null);
    try {
      await approve.mutateAsync(p.membershipId);
      toast.success(`${p.name} was approved.`);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  const doShares = async () => {
    if (!sharesFor) return;
    try {
      await setShares.mutateAsync({ membershipId: sharesFor.membershipId, shares: newShares });
      toast.success('Shares updated.');
      setSharesFor(null);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
      setSharesFor(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">A person joins once the circle has approved them, they have a phone number, they accepted the rules, and any guarantor is recorded.</p>
        {can && group && (group.status === 'OPEN' || group.status === 'ACTIVE' || group.status === 'DRAFT') && <Button onClick={() => setAdding(true)}>Add a person</Button>}
      </div>
      {problem && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-text">{problem}</p>}

      {roster.isLoading ? <AjoLoading /> : roster.isError ? <AjoError error={roster.error} onRetry={() => roster.refetch()} /> : roster.data && roster.data.people.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr><th className="px-4 py-2 font-medium">Person</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">SocietyLedger check</th><th className="px-4 py-2 font-medium">On-time record</th><th className="px-4 py-2 font-medium">Rules</th><th className="px-4 py-2 font-medium">Waiting for</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {roster.data.people.map((p) => (
                <tr key={p.membershipId} className="border-t border-line-soft align-top">
                  <td className="px-4 py-3"><p className="font-medium">{p.name}{rotating && p.shares > 1 ? ` (${p.shares} shares)` : ''}</p><p className="text-xs text-ink-faint">{p.phone ?? 'No phone'}{p.hasLogin ? '' : ' · no login'}</p></td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.verification} />{can && p.verification === 'REJECTED' && <Button className="mt-1 block" size="compact-xs" variant="subtle" loading={recheck.isPending && recheck.variables === p.memberId} onClick={async () => { setProblem(null); try { await recheck.mutateAsync(p.memberId); toast.success(`${p.name}'s details were sent to be checked again.`); } catch (error) { setProblem(ajoErrorMessage(error)); } }}>Check again</Button>}</td>
                  <td className="px-4 py-3 text-xs">{trustOf.get(p.membershipId) ? <><StatusBadge status={trustOf.get(p.membershipId)!.band} />{trustOf.get(p.membershipId)!.onTimePercent !== null && <span className="ml-1 text-ink-muted">{trustOf.get(p.membershipId)!.onTimePercent}% on time</span>}</> : '—'}</td>
                  <td className="px-4 py-3 text-xs">{p.acceptedRuleVersion ? `Version ${p.acceptedRuleVersion}${p.acceptedVia ? ` (${p.acceptedVia})` : ''}` : 'Not accepted'}{p.guarantorRecorded ? ' · guarantor on file' : ''}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{p.waitingFor.length ? <ul className="list-disc pl-4">{p.waitingFor.map((w) => <li key={w.requirement}>{w.text}</li>)}</ul> : '—'}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {can && p.status === 'PENDING' && !p.approvedAt && <Button size="compact-xs" color="green" onClick={() => doApprove(p)} loading={approve.isPending && approve.variables === p.membershipId}>Approve</Button>}
                    {can && p.status !== 'LEFT' && p.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE') && <Button size="compact-xs" variant="subtle" onClick={() => setRulesFor(p)}>Record rules acceptance</Button>}
                    {can && p.status !== 'LEFT' && <Button size="compact-xs" variant="subtle" onClick={() => setGuarantorFor(p)}>Guarantor</Button>}
                    {can && rotating && group?.status !== 'ACTIVE' && p.status !== 'LEFT' && <Button size="compact-xs" variant="subtle" onClick={() => { setSharesFor(p); setNewShares(p.shares); }}>Shares</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <AjoEmpty title="Nobody has been added yet." hint="Add association members to this circle, then approve them." />}

      <AddMemberDialog groupId={groupId} opened={adding} onClose={() => setAdding(false)} rotating={!!rotating} maxShares={group?.maxSharesPerMember ?? 1} />
      <GuarantorDialog person={guarantorFor} onClose={() => setGuarantorFor(null)} />
      <RecordRulesAcceptanceDialog person={rulesFor} groupId={groupId} onClose={() => setRulesFor(null)} />
      <Modal opened={sharesFor !== null} onClose={() => setSharesFor(null)} title={`Shares for ${sharesFor?.name ?? ''}`} centered size="sm">
        <div className="space-y-4">
          <NumberInput label="Shares" min={1} max={group?.maxSharesPerMember ?? 1} value={newShares} onChange={(v) => setNewShares(typeof v === 'number' ? v : 1)} />
          <div className="flex justify-end gap-2"><Button variant="default" onClick={() => setSharesFor(null)}>Cancel</Button><Button color="green" onClick={doShares} loading={setShares.isPending}>Save</Button></div>
        </div>
      </Modal>
    </div>
  );
}

