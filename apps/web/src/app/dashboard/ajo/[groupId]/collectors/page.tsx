'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, MultiSelect, NativeSelect, TextInput } from '@mantine/core';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoAction, useCollectorCandidates, useCollectors, useRoster } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

/** THO8: which collector looks after which contributors, and their daily targets. A person has one collector at a time. */
export default function CollectorsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();
  const assignments = useCollectors(groupId);
  const roster = useRoster(groupId);
  const candidates = useCollectorCandidates();
  const assign = useAjoAction((input: { membershipId: number; collectorUserId: number; dailyTargetKobo: string | null }) => ajoStaffApi.assignCollector(input.membershipId, { collectorUserId: input.collectorUserId, dailyTargetKobo: input.dailyTargetKobo }));
  const unassign = useAjoAction((membershipId: number) => ajoStaffApi.unassignCollector(membershipId));
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [collector, setCollector] = useState('');
  const [target, setTarget] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const can = manage && canWrite;

  const names = new Map((roster.data?.people ?? []).map((p) => [p.membershipId, p.name]));
  const collectorName = (userId: number) => candidates.data?.find((c) => c.userId === userId)?.name ?? `User ${userId}`;
  const current = (assignments.data ?? []).filter((a) => !a.endsOn || new Date(a.endsOn).getTime() >= Date.now());
  const byPerson = new Map(current.map((a) => [a.membershipId, a]));
  const eligible = (roster.data?.people ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'PENDING');

  const submit = async () => {
    if (!collector) return setProblem('Choose the collector.');
    if (people.length === 0) return setProblem('Choose at least one person.');
    let dailyTargetKobo: string | null = null;
    if (target.trim()) {
      const kobo = nairaToKobo(target);
      if (kobo === null) return setProblem('Enter the daily target in naira, or leave it empty.');
      dailyTargetKobo = kobo.toString();
    }
    setProblem(null);
    try {
      for (const id of people) await assign.mutateAsync({ membershipId: Number(id), collectorUserId: Number(collector), dailyTargetKobo });
      toast.success(`${people.length} ${people.length === 1 ? 'person was' : 'people were'} assigned.`);
      setOpen(false);
      setPeople([]);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  if (assignments.isLoading) return <AjoLoading />;
  if (assignments.isError) return <AjoError error={assignments.error} onRetry={() => assignments.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">Collectors go round and receive cash. They need the collector permission to be listed here. A collector only ever sees the contributors assigned to them.</p>
        {can && <Button onClick={() => setOpen(true)}>Assign contributors</Button>}
      </div>

      {eligible.length === 0 ? <AjoEmpty title="Nobody is in this group yet." /> : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-800 dark:text-gray-400"><tr><th className="px-4 py-2 font-medium">Contributor</th><th className="px-4 py-2 font-medium">Collector</th><th className="px-4 py-2 text-right font-medium">Daily target</th><th className="px-4 py-2 font-medium">Since</th><th className="px-4 py-2" /></tr></thead>
            <tbody>
              {eligible.map((p) => {
                const a = byPerson.get(p.membershipId);
                return (
                  <tr key={p.membershipId} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{a ? collectorName(a.collectorUserId) : <span className="text-gray-400">None (pays by transfer)</span>}</td>
                    <td className="px-4 py-3 text-right">{a?.dailyTargetKobo ? <Money kobo={a.dailyTargetKobo} /> : '—'}</td>
                    <td className="px-4 py-3">{a ? formatDay(a.startsOn) : ''}</td>
                    <td className="px-4 py-3 text-right">{can && a && <Button size="compact-xs" variant="subtle" color="red" onClick={() => unassign.mutate(p.membershipId, { onError: (e) => setProblem(ajoErrorMessage(e)) })}>Remove</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {problem && !open && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <Modal opened={open} onClose={() => setOpen(false)} title="Assign contributors to a collector" centered size="lg">
        <div className="space-y-4">
          <NativeSelect label="Collector" data={[{ value: '', label: candidates.data?.length ? 'Choose…' : 'No one has the collector permission yet' }, ...(candidates.data ?? []).map((c) => ({ value: String(c.userId), label: `${c.name} (${c.email})` }))]} value={collector} onChange={(e) => setCollector(e.currentTarget.value)} />
          <MultiSelect label="Contributors" searchable data={eligible.map((p) => ({ value: String(p.membershipId), label: p.name }))} value={people} onChange={setPeople} placeholder="Choose people" />
          <TextInput label="Daily target (₦, optional)" description="What you expect this collector to bring in each day from these people." inputMode="decimal" value={target} onChange={(e) => setTarget(e.currentTarget.value)} />
          {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={() => setOpen(false)}>Cancel</Button><Button color="green" onClick={submit} loading={assign.isLoading}>Assign</Button></div>
        </div>
      </Modal>
    </div>
  );
}
