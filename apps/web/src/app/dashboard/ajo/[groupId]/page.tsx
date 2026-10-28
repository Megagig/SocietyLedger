'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal, NumberInput, TextInput } from '@mantine/core';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { Money } from '@/components/ajo/Money';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoAction, useGroupDetail } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

const FEE_TEXT = { NONE: 'No collector fee', FIXED: 'A fixed amount', PERCENT: 'A percentage of the pot', DAYS: 'Days of contribution' } as const;

/** THO2 (edit and settings) with the group's lifecycle: draft, open for joining, running, completed or cancelled. */
export default function GroupOverviewPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();
  const group = useGroupDetail(groupId).data;
  const open = useAjoAction<void>(() => ajoStaffApi.openGroup(groupId));
  const start = useAjoAction((confirmSmaller: boolean) => ajoStaffApi.startGroup(groupId, confirmSmaller));
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [smaller, setSmaller] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (!group) return null;
  const can = manage && canWrite;

  const doOpen = async () => {
    setProblem(null);
    try {
      await open.mutateAsync();
      toast.success('The group is open. Members can now be added and approved.');
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  const doStart = async (confirmSmaller: boolean) => {
    setProblem(null);
    try {
      await start.mutateAsync(confirmSmaller);
      setSmaller(null);
      toast.success('The group has started. The schedule is ready.');
    } catch (error) {
      if (ajoErrorCode(error) === 'CONFIRM_SMALLER_GROUP') setSmaller(ajoErrorMessage(error));
      else setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      {problem && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{problem}</p>}

      {can && group.status === 'DRAFT' && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="font-medium text-blue-900 dark:text-blue-100">This group is a draft.</p>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Check the details below, then open it so you can add and approve people.</p>
          <Button className="mt-3" onClick={doOpen} loading={open.isLoading}>Open for joining</Button>
        </section>
      )}
      {can && group.status === 'OPEN' && (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="font-medium text-green-900 dark:text-green-100">{group.activeParticipants} of {group.maxParticipants} people are approved.</p>
          <p className="mt-1 text-sm text-green-800 dark:text-green-200">Starting fixes the group, draws the payout order (for a rotating pot) and creates everyone&apos;s payment schedule.</p>
          {smaller ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-green-900 dark:text-green-100">{smaller}</p>
              <div className="flex gap-2"><Button color="green" onClick={() => doStart(true)} loading={start.isLoading}>Start with {group.activeParticipants} people</Button><Button variant="default" onClick={() => setSmaller(null)}>Wait for more</Button></div>
            </div>
          ) : (
            <Button className="mt-3" color="green" onClick={() => doStart(false)} loading={start.isLoading}>Start the group</Button>
          )}
        </section>
      )}
      {group.status === 'CANCELLED' && <p className="rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800">This group was cancelled{group.cancelReason ? `: ${group.cancelReason}` : '.'}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Each pays', <Money key="a" kobo={group.contributionKobo} />],
          ['Seats taken', `${group.seats.taken} of ${group.seats.total}`],
          ['First payment', formatDay(group.startDate)],
          [group.model === 'ROTATING_POT' ? 'Rounds' : 'Payments in the cycle', String(group.rounds ?? group.cycleLength ?? '—')],
          ['Collector fee', group.collectorFee.type === 'NONE' ? 'None' : `${FEE_TEXT[group.collectorFee.type]}: ${group.collectorFee.type === 'FIXED' ? formatKobo(group.collectorFee.value) : group.collectorFee.type === 'PERCENT' ? `${Number(group.collectorFee.value) / 100}%` : `${group.collectorFee.value} day(s)`}`],
          ['Current rules', group.currentRuleVersion ? `Version ${group.currentRuleVersion}` : 'None yet'],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="font-semibold">Where members pay</h2>
        {group.bankAccount ? <p className="mt-1 text-sm">{group.bankAccount.bankName} · {group.bankAccount.accountName} · <span className="font-mono tabular-nums">{group.bankAccount.masked}</span></p> : <p className="mt-1 text-sm text-red-600">No bank account has been added yet. Members cannot pay until one is.</p>}
        <p className="mt-1 text-xs text-gray-500">Timezone {group.timezone}, cut-off {group.cutoffTime}. Members {group.requirePhoneConfirm ? 'must' : 'do not need to'} confirm their phone number.</p>
      </section>

      {can && (group.status === 'DRAFT' || group.status === 'OPEN' || group.status === 'ACTIVE') && (
        <div className="flex flex-wrap gap-2">
          {(group.status === 'DRAFT' || group.status === 'OPEN') && <Button variant="default" onClick={() => setEditing(true)}>Edit settings</Button>}
          <Button variant="subtle" color="red" onClick={() => setCancelling(true)}>Cancel this group</Button>
        </div>
      )}

      <ActionDialog opened={cancelling} onClose={() => setCancelling(false)} title="Cancel this group" color="red" confirmLabel="Cancel the group" reasonMin={10} reasonLabel="Why is it being cancelled" successMessage="The group was cancelled."
        summary="Cancelling stops the group for everyone. Money already recorded stays on the record; nothing is deleted." onConfirm={({ reason }) => ajoStaffApi.cancelGroup(groupId, reason)} />
      <EditSettings open={editing} onClose={() => setEditing(false)} groupId={groupId} />
    </div>
  );
}

function EditSettings({ open, onClose, groupId }: { open: boolean; onClose: () => void; groupId: number }) {
  const group = useGroupDetail(groupId).data;
  const save = useAjoAction((body: Parameters<typeof ajoStaffApi.updateGroup>[1]) => ajoStaffApi.updateGroup(groupId, body));
  const [name, setName] = useState('');
  const [contribution, setContribution] = useState('');
  const [max, setMax] = useState<number>(1);
  const [cutoff, setCutoff] = useState('');
  const [phone, setPhone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Start from the group's current values each time the editor is opened.
  useEffect(() => {
    if (!open || !group) return;
    setName(group.name);
    setContribution((Number(group.contributionKobo) / 100).toFixed(2));
    setMax(group.maxParticipants);
    setCutoff(group.cutoffTime);
    setPhone(group.requirePhoneConfirm);
    setProblem(null);
  }, [open, group]);
  if (!group) return null;

  const submit = async () => {
    const kobo = nairaToKobo(contribution);
    if (kobo === null || kobo <= BigInt(0)) return setProblem('Enter how much each person pays, in naira.');
    try {
      await save.mutateAsync({ name: name.trim(), contributionKobo: kobo.toString(), maxParticipants: max, cutoffTime: cutoff, requirePhoneConfirm: phone });
      toast.success('Settings saved.');
      onClose();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  return (
    <Modal opened={open} onClose={onClose} title="Edit settings" centered>
      <div className="space-y-4">
        <TextInput label="Group name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Each person pays (₦)" inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.currentTarget.value)} />
        <NumberInput label="Most people in the group" min={1} max={2000} value={max} onChange={(v) => setMax(typeof v === 'number' ? v : 1)} />
        <TextInput label="Cut-off time each day" value={cutoff} onChange={(e) => setCutoff(e.currentTarget.value)} />
        <Checkbox label="Members must confirm their phone number" checked={phone} onChange={(e) => setPhone(e.currentTarget.checked)} />
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        <div className="flex justify-end gap-2"><Button variant="default" onClick={onClose}>Cancel</Button><Button color="green" onClick={submit} loading={save.isLoading}>Save</Button></div>
      </div>
    </Modal>
  );
}
