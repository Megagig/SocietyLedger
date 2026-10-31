'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal, NativeSelect, NumberInput, TextInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { BoardSettingCard } from '@/components/ajo/BoardSettingCard';
import { Money } from '@/components/ajo/Money';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, nairaToKobo } from '@/lib/ajo/format';
import { boardSetting } from '@/lib/ajo/boardSetting';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoAction, useGroupDetail, useRuleVersions } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { toast } from '@/lib/toast';

const FEE_TEXT = { NONE: 'No collector fee', FIXED: 'A fixed amount', PERCENT: 'A percentage of the pot', DAYS: 'Days of contribution' } as const;

/** THO2 (edit and settings) with the circle's lifecycle: draft, open for joining, running, completed or cancelled. */
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
  // Once the circle starts the board can no longer be turned on instantly, so ask about it first if it is off.
  const ruleVersions = useRuleVersions(groupId);
  const [boardAsk, setBoardAsk] = useState<{ confirmSmaller: boolean } | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  // Each action's refusal is shown in the panel the action lives in, right under its button, not at the top of the page.
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  const [startProblem, setStartProblem] = useState<string | null>(null);

  if (!group) return null;
  const can = manage && canWrite;

  const doOpen = async () => {
    setOpenProblem(null);
    try {
      await open.mutateAsync();
      toast.success('The circle is open. Members can now be added and approved.');
    } catch (error) {
      setOpenProblem(ajoErrorMessage(error));
    }
  };
  const boardOff = group.model === 'ROTATING_POT' && !!ruleVersions.data && ['OFF', 'TURNS_ON'].includes(boardSetting(ruleVersions.data.versions).state);
  const requestStart = (confirmSmaller: boolean) => (boardOff ? setBoardAsk({ confirmSmaller }) : doStart(confirmSmaller));
  const turnBoardOnThenStart = async () => {
    if (!boardAsk) return;
    setBoardBusy(true);
    setStartProblem(null);
    try {
      await ajoStaffApi.publishRules(groupId, { memberVisibility: 'FULL' }, { immediate: true });
      const again = boardAsk.confirmSmaller;
      setBoardAsk(null);
      await doStart(again);
    } catch (error) {
      setBoardAsk(null);
      setStartProblem(ajoErrorMessage(error));
    } finally {
      setBoardBusy(false);
    }
  };
  const doStart = async (confirmSmaller: boolean) => {
    setStartProblem(null);
    try {
      await start.mutateAsync(confirmSmaller);
      setSmaller(null);
      toast.success('The circle has started. The schedule is ready.');
    } catch (error) {
      if (ajoErrorCode(error) === 'CONFIRM_SMALLER_GROUP') setSmaller(ajoErrorMessage(error));
      else setStartProblem(ajoErrorMessage(error));
    }
  };
  const noOneApproved = group.activeParticipants <= 0;
  const refusal = (text: string | null) =>
    text ? (
      <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger-text">
        <IconAlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{text}</span>
      </p>
    ) : null;

  return (
    <div className="space-y-6">

      {can && group.status === 'DRAFT' && (
        <section className="rounded-lg border border-info-line bg-info-soft p-4">
          <p className="font-medium text-info-strong">This circle is a draft.</p>
          <p className="mt-1 text-sm text-info-text">Check the details below, then open it so you can add and approve people.</p>
          <Button className="mt-3" onClick={doOpen} loading={open.isPending}>Open for joining</Button>
          {refusal(openProblem)}
        </section>
      )}
      {can && group.status === 'OPEN' && (
        <section className="rounded-lg border border-success-line bg-success-soft p-4">
          <p className="font-medium text-success-strong">{group.activeParticipants} of {group.maxParticipants} people are approved.</p>
          <p className="mt-1 text-sm text-success-text">Starting fixes the circle, draws the payout order (for a rotating pot) and creates everyone&apos;s payment schedule.</p>
          {smaller ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-success-strong">{smaller}</p>
              <div className="flex gap-2"><Button color="green" onClick={() => requestStart(true)} loading={start.isPending}>Start with {group.activeParticipants} people</Button><Button variant="default" onClick={() => setSmaller(null)}>Wait for more</Button></div>
            </div>
          ) : noOneApproved ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-success-strong" data-testid="ajo-start-blocked">Nobody is approved yet. Approve at least one person on Members, then start the circle.</p>
              <div className="flex flex-wrap gap-2">
                <Button component={Link} href={`/dashboard/ajo/${groupId}/members`} color="green" variant="light">Go to Members</Button>
                <Button color="green" disabled>Start the circle</Button>
              </div>
            </div>
          ) : (
            <Button className="mt-3" color="green" onClick={() => requestStart(false)} loading={start.isPending}>Start the circle</Button>
          )}
          {refusal(startProblem)}
          {startProblem && /draw/i.test(startProblem) && (
            <Button component={Link} href={`/dashboard/ajo/${groupId}/order`} className="mt-2" variant="default">Go to Payout order to draw again</Button>
          )}
          {startProblem && /start date/i.test(startProblem) && (
            <Button className="mt-2" variant="default" onClick={() => setEditing(true)}>Change the start date</Button>
          )}
        </section>
      )}
      {group.status === 'CANCELLED' && <p className="rounded-md bg-surface-sunken p-3 text-sm">This circle was cancelled{group.cancelReason ? `: ${group.cancelReason}` : '.'}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Each pays', <Money key="a" kobo={group.contributionKobo} />],
          ['Seats taken', `${group.seats.taken} of ${group.seats.total}`],
          ['First payment', formatDay(group.startDate)],
          [group.model === 'ROTATING_POT' ? 'Rounds' : 'Payments in the cycle', String(group.rounds ?? group.cycleLength ?? '—')],
          ['Collector fee', group.collectorFee.type === 'NONE' ? 'None' : `${FEE_TEXT[group.collectorFee.type]}: ${group.collectorFee.type === 'FIXED' ? formatKobo(group.collectorFee.value) : group.collectorFee.type === 'PERCENT' ? `${Number(group.collectorFee.value) / 100}%` : `${group.collectorFee.value} day(s)`}`],
          ['Current rules', group.currentRuleVersion ? `Version ${group.currentRuleVersion}` : 'None yet'],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-line p-4">
            <p className="text-xs text-ink-faint">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line p-4">
        <h2 className="font-semibold">Where members pay</h2>
        {group.bankAccount ? <p className="mt-1 text-sm">{group.bankAccount.bankName} · {group.bankAccount.accountName} · <span className="font-mono tabular-nums">{group.bankAccount.masked}</span></p> : <p className="mt-1 text-sm text-danger">No bank account has been added yet. Members cannot pay until one is.</p>}
        <p className="mt-1 text-xs text-ink-faint">Timezone {group.timezone}, cut-off {group.cutoffTime}. Members {group.requirePhoneConfirm ? 'must' : 'do not need to'} confirm their phone number.</p>
      </section>

      {group.model === 'ROTATING_POT' && (
        <section className="rounded-lg border border-line p-4" aria-label="Payout order">
          <h2 className="font-semibold">Payout order</h2>
          <p className="mt-1 text-sm">{group.orderMethod === 'ADMIN_SET' ? 'Set by the admin, with a written reason every member can read.' : 'An automatic draw, recorded with its seed. Anyone can check it.'}</p>
          <Button component={Link} href={`/dashboard/ajo/${groupId}/order`} variant="default" size="xs" className="mt-2">{group.orderMethod === 'ADMIN_SET' ? 'Set the order' : 'Go to Payout order'}</Button>
        </section>
      )}
      {group.model === 'ROTATING_POT' && <BoardSettingCard groupId={groupId} canChange={can} groupStatus={group.status} />}

      {can && (group.status === 'DRAFT' || group.status === 'OPEN' || group.status === 'ACTIVE') && (
        <div className="flex flex-wrap gap-2">
          {(group.status === 'DRAFT' || group.status === 'OPEN') && <Button variant="default" onClick={() => setEditing(true)}>Edit settings</Button>}
          <Button variant="subtle" color="red" onClick={() => setCancelling(true)}>Cancel this circle</Button>
        </div>
      )}

      <Modal opened={boardAsk !== null} onClose={() => setBoardAsk(null)} title="The Circle board is off" centered>
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Members will not see each other’s progress. You can turn the board on instantly only until the circle starts; after that a change needs 7 days’ notice.</p>
          <p className="text-sm text-ink-muted">A person’s name shows on the board only after they accept rules that include it; until then they appear as “Member 3”.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="default" onClick={() => setBoardAsk(null)}>Cancel</Button>
            <Button variant="default" onClick={() => { const again = boardAsk?.confirmSmaller ?? false; setBoardAsk(null); void doStart(again); }}>Start without the board</Button>
            <Button color="green" onClick={turnBoardOnThenStart} loading={boardBusy}>Turn it on, then start</Button>
          </div>
        </div>
      </Modal>

      <ActionDialog opened={cancelling} onClose={() => setCancelling(false)} title="Cancel this circle" color="red" confirmLabel="Cancel the circle" reasonMin={10} reasonLabel="Why is it being cancelled" successMessage="The circle was cancelled."
        summary="Cancelling stops the circle for everyone. Money already recorded stays on the record; nothing is deleted." onConfirm={({ reason }) => ajoStaffApi.cancelGroup(groupId, reason)} />
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
  const [startDay, setStartDay] = useState('');
  const [orderMethod, setOrderMethod] = useState<'RANDOM_DRAW' | 'ADMIN_SET'>('RANDOM_DRAW');
  const [phone, setPhone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Start from the circle's current values each time the editor is opened.
  useEffect(() => {
    if (!open || !group) return;
    setName(group.name);
    setContribution((Number(group.contributionKobo) / 100).toFixed(2));
    setMax(group.maxParticipants);
    setCutoff(group.cutoffTime);
    // A start date that has already passed cannot be used: offer today so saving is one click.
    const saved = String(group.startDate).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    setStartDay(saved < today && (group.status === 'DRAFT' || group.status === 'OPEN') ? today : saved);
    setOrderMethod(group.orderMethod);
    setPhone(group.requirePhoneConfirm);
    setProblem(null);
  }, [open, group]);
  if (!group) return null;

  const submit = async () => {
    const kobo = nairaToKobo(contribution);
    if (kobo === null || kobo <= BigInt(0)) return setProblem('Enter how much each person pays, in naira.');
    const today = new Date().toISOString().slice(0, 10);
    const dayChanged = startDay !== String(group.startDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return setProblem('Choose the day the circle starts.');
    if (dayChanged && startDay < today) return setProblem('The start date must be today or later.');
    try {
      await save.mutateAsync({ name: name.trim(), contributionKobo: kobo.toString(), maxParticipants: max, cutoffTime: cutoff, requirePhoneConfirm: phone, ...(dayChanged ? { startDate: startDay } : {}), ...(group.model === 'ROTATING_POT' && orderMethod !== group.orderMethod ? { orderMethod } : {}) });
      toast.success('Settings saved.');
      onClose();
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };
  return (
    <Modal opened={open} onClose={onClose} title="Edit settings" centered>
      <div className="space-y-4">
        <TextInput label="Circle name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Each person pays (₦)" inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.currentTarget.value)} />
        <NumberInput label="Most people in the circle" min={1} max={2000} value={max} onChange={(v) => setMax(typeof v === 'number' ? v : 1)} />
        <TextInput label="First payment date" type="date" value={startDay} onChange={(e) => setStartDay(e.currentTarget.value)} description="The day the circle starts. It cannot be in the past." />
        <TextInput label="Cut-off time each day" value={cutoff} onChange={(e) => setCutoff(e.currentTarget.value)} />
        {group.model === 'ROTATING_POT' && (
          <NativeSelect
            label="How the payout order is decided"
            description="Changing this clears any order already made, and it is fixed once the circle starts."
            data={[{ value: 'RANDOM_DRAW', label: 'Automatic draw (recorded, anyone can check it)' }, { value: 'ADMIN_SET', label: 'Admin sets the order (with a written reason)' }]}
            value={orderMethod}
            onChange={(e) => setOrderMethod(e.currentTarget.value as 'RANDOM_DRAW' | 'ADMIN_SET')}
          />
        )}
        <Checkbox label="Members must confirm their phone number" checked={phone} onChange={(e) => setPhone(e.currentTarget.checked)} />
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        <div className="flex justify-end gap-2"><Button variant="default" onClick={onClose}>Cancel</Button><Button color="green" onClick={submit} loading={save.isPending}>Save</Button></div>
      </div>
    </Modal>
  );
}
