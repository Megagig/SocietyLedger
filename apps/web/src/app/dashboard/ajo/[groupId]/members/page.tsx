'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, NumberInput, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import api from '@/lib/axios';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { RosterPersonDTO } from '@/lib/ajo/staffTypes';
import { useAjoAction, useGroupDetail, useRoster } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

/** SocietyLedger's own check of a person's payout details, shown beside their name. A person without a member record shows nothing. */
function VerificationCell({ memberId }: { memberId: number }) {
  const status = useQuery({ queryKey: ['ajo', 'staff', 'verification', memberId], queryFn: () => ajoStaffVerification(memberId), retry: false, staleTime: 60_000 });
  if (!status.data) return <span className="text-xs text-gray-400">…</span>;
  return <StatusBadge status={status.data.status} />;
}
async function ajoStaffVerification(memberId: number) {
  const response = await api.get<{ data: { status: 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' } }>(`/ajo/members/${memberId}/verification`);
  return response.data.data;
}

function AddMemberDialog({ groupId, opened, onClose, rotating, maxShares }: { groupId: number; opened: boolean; onClose: () => void; rotating: boolean; maxShares: number }) {
  const [search, setSearch] = useState('');
  const [shares, setShares] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);
  const people = useQuery({ queryKey: ['ajo', 'staff', 'people', search], queryFn: () => ajoStaffApi.searchPeople(search), enabled: opened, keepPreviousData: true });
  const add = useAjoAction((input: { memberId: number }) => ajoStaffApi.addMember(groupId, input.memberId, rotating ? shares : undefined));

  const choose = async (memberId: number, name: string) => {
    setProblem(null);
    try {
      await add.mutateAsync({ memberId });
      toast.success(`${name} was added. They need the group to approve them.`);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add a person" centered size="lg">
      <div className="space-y-4">
        <TextInput label="Find an association member" placeholder="Name, member number or phone" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        {rotating && <NumberInput label="Shares" description="A person with two shares pays twice each round and collects twice." min={1} max={maxShares} value={shares} onChange={(v) => setShares(typeof v === 'number' ? v : 1)} />}
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        {people.isLoading ? <AjoLoading rows={2} /> : people.isError ? <AjoError error={people.error} /> : people.data && people.data.length > 0 ? (
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {people.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-gray-500">{p.memberNumber}{p.phone ? ` · ${p.phone}` : ' · no phone yet'}{p.hasLogin ? '' : ' · no login'}</p></div>
                <Button size="compact-sm" variant="light" onClick={() => choose(p.id, p.name)} loading={add.isLoading && add.variables?.memberId === p.id}>Add</Button>
              </li>
            ))}
          </ul>
        ) : <AjoEmpty title="Nobody matches." hint="Only active association members can be added." />}
      </div>
    </Modal>
  );
}

function GuarantorDialog({ person, onClose }: { person: RosterPersonDTO | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [note, setNote] = useState('');
  const [wording, setWording] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAjoAction((body: Parameters<typeof ajoStaffApi.recordGuarantor>[1]) => ajoStaffApi.recordGuarantor(person?.membershipId ?? 0, body));

  const showWording = async () => {
    if (!person || name.trim().length < 2) return setProblem('Enter the guarantor’s name first.');
    setProblem(null);
    try {
      setWording((await ajoStaffApi.guarantorWording(person.membershipId, name.trim())).wording);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  const submit = async () => {
    if (!wording) return setProblem('Read the wording to the guarantor first, using “Show the wording”.');
    if (note.trim().length < 5) return setProblem('Say how the guarantor agreed (for example “agreed by phone on 5 March”).');
    try {
      await save.mutateAsync({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim(), note: note.trim() });
      toast.success('The guarantor’s agreement was recorded.');
      onClose();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={person !== null} onClose={onClose} title={`Guarantor for ${person?.name ?? ''}`} centered size="lg">
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">A guarantor is a recorded agreement only. Nothing is ever taken from them automatically. Record that they heard and agreed to the wording below.</p>
        <TextInput label="Guarantor’s name" value={name} onChange={(e) => { setName(e.currentTarget.value); setWording(null); }} />
        <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
        <TextInput label="Relationship to the member" value={relationship} onChange={(e) => setRelationship(e.currentTarget.value)} />
        <Button variant="light" size="xs" onClick={showWording}>Show the wording</Button>
        {wording && <p className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800">{wording}</p>}
        <Textarea label="How they agreed" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        <div className="flex justify-end gap-2"><Button variant="default" onClick={onClose}>Cancel</Button><Button color="green" onClick={submit} loading={save.isLoading}>Record agreement</Button></div>
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
  const [adding, setAdding] = useState(false);
  const [guarantorFor, setGuarantorFor] = useState<RosterPersonDTO | null>(null);
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
        <p className="text-sm text-gray-600 dark:text-gray-400">A person joins once the group has approved them, they have a phone number, they accepted the rules, and any guarantor is recorded.</p>
        {can && group && (group.status === 'OPEN' || group.status === 'ACTIVE' || group.status === 'DRAFT') && <Button onClick={() => setAdding(true)}>Add a person</Button>}
      </div>
      {problem && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{problem}</p>}

      {roster.isLoading ? <AjoLoading /> : roster.isError ? <AjoError error={roster.error} onRetry={() => roster.refetch()} /> : roster.data && roster.data.people.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <tr><th className="px-4 py-2 font-medium">Person</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">SocietyLedger check</th><th className="px-4 py-2 font-medium">Rules</th><th className="px-4 py-2 font-medium">Waiting for</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {roster.data.people.map((p) => (
                <tr key={p.membershipId} className="border-t border-gray-100 align-top dark:border-gray-700">
                  <td className="px-4 py-3"><p className="font-medium">{p.name}{rotating && p.shares > 1 ? ` (${p.shares} shares)` : ''}</p><p className="text-xs text-gray-500">{p.phone ?? 'No phone'}{p.hasLogin ? '' : ' · no login'}</p></td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><VerificationCell memberId={p.memberId} /></td>
                  <td className="px-4 py-3 text-xs">{p.acceptedRuleVersion ? `Version ${p.acceptedRuleVersion}${p.acceptedVia ? ` (${p.acceptedVia})` : ''}` : 'Not accepted'}{p.guarantorRecorded ? ' · guarantor on file' : ''}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{p.waitingFor.length ? <ul className="list-disc pl-4">{p.waitingFor.map((w) => <li key={w.requirement}>{w.text}</li>)}</ul> : '—'}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {can && p.status === 'PENDING' && !p.approvedAt && <Button size="compact-xs" color="green" onClick={() => doApprove(p)} loading={approve.isLoading && approve.variables === p.membershipId}>Approve</Button>}
                    {can && p.status !== 'LEFT' && <Button size="compact-xs" variant="subtle" onClick={() => setGuarantorFor(p)}>Guarantor</Button>}
                    {can && rotating && group?.status !== 'ACTIVE' && p.status !== 'LEFT' && <Button size="compact-xs" variant="subtle" onClick={() => { setSharesFor(p); setNewShares(p.shares); }}>Shares</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <AjoEmpty title="Nobody has been added yet." hint="Add association members to this group, then approve them." />}

      <AddMemberDialog groupId={groupId} opened={adding} onClose={() => setAdding(false)} rotating={!!rotating} maxShares={group?.maxSharesPerMember ?? 1} />
      <GuarantorDialog person={guarantorFor} onClose={() => setGuarantorFor(null)} />
      <Modal opened={sharesFor !== null} onClose={() => setSharesFor(null)} title={`Shares for ${sharesFor?.name ?? ''}`} centered size="sm">
        <div className="space-y-4">
          <NumberInput label="Shares" min={1} max={group?.maxSharesPerMember ?? 1} value={newShares} onChange={(v) => setNewShares(typeof v === 'number' ? v : 1)} />
          <div className="flex justify-end gap-2"><Button variant="default" onClick={() => setSharesFor(null)}>Cancel</Button><Button color="green" onClick={doShares} loading={setShares.isLoading}>Save</Button></div>
        </div>
      </Modal>
    </div>
  );
}

