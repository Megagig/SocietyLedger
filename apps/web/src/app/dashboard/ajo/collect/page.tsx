'use client';

import { useRef, useState } from 'react';
import { Button, Modal, NativeSelect, TextInput } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo, koboPositive, nairaToKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { AssignedContributorDTO } from '@/lib/ajo/staffTypes';
import { useCollectorDay, useMyContributors } from '@/lib/ajo/staffHooks';
import { toast } from '@/lib/toast';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** THC2: write down cash taken from one person. It is marked "cash received, awaiting reconciliation" until the handover is counted. */
function RecordCashDialog({ person, groupId, onClose }: { person: AssignedContributorDTO | null; groupId: number; onClose: () => void }) {
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey()); // one key per attempt, so a double tap or a retry records it once

  const close = () => { setAmount(''); setProblem(null); setBusy(false); onClose(); };
  const submit = async () => {
    if (!person) return;
    const kobo = nairaToKobo(amount);
    if (kobo === null || kobo <= BigInt(0)) return setProblem('Enter the amount you received, for example 500 or 1,500.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.recordCash(groupId, { membershipId: person.membershipId, amountKobo: kobo.toString(), idempotencyKey: key.current });
      key.current = newKey();
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(`${formatKobo(kobo.toString())} from ${person.name} was recorded.`);
      close();
    } catch (error) {
      setBusy(false);
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={person !== null} onClose={close} title={`Cash from ${person?.name ?? ''}`} centered size="sm">
      <div className="space-y-4">
        <TextInput label="Amount received (₦)" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />
        <p className="text-xs text-ink-faint">It stays &quot;cash received, awaiting reconciliation&quot; until you hand the cash over and an officer counts it.</p>
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        <div className="flex justify-end gap-2"><Button variant="default" onClick={close}>Cancel</Button><Button color="green" onClick={submit} loading={busy}>Record cash</Button></div>
      </div>
    </Modal>
  );
}

/** THC1 to THC3: a collector's day. Who to see, record what they paid, then hand the cash over. Needs the internet. */
export default function CollectPage() {
  const { canWrite } = useAjoAccess();
  const client = useQueryClient();
  const mine = useMyContributors();
  const groupIds = [...new Set((mine.data ?? []).map((c) => c.groupId))];
  const [chosen, setChosen] = useState<number | null>(null);
  const groupId = chosen ?? groupIds[0] ?? 0;
  const day = useCollectorDay(groupId);
  const [cashFor, setCashFor] = useState<AssignedContributorDTO | null>(null);
  const [handing, setHanding] = useState(false);
  const [handed, setHanded] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!mine.data || mine.data.length === 0) return <AjoEmpty title="You have no contributors assigned yet." hint="An officer assigns the people you collect from." />;

  const groupName = (id: number) => mine.data?.find((c) => c.groupId === id)?.groupName ?? 'Circle';
  const people = mine.data.filter((c) => c.groupId === groupId);
  const paidToday = new Set((day.data?.payments ?? []).map((p) => p.name));
  const alreadyHanded = !!day.data?.handover;

  const handOver = async () => {
    const kobo = nairaToKobo(handed || '0');
    if (kobo === null) return setProblem('Enter the cash you are handing over in naira. Enter 0 if you have none.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.handOver(groupId, { handedOverKobo: kobo.toString(), note: note.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Your handover was recorded. An officer will count it.');
      setHanding(false);
      setHanded('');
      setNote('');
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">Today&apos;s collection</h1>
          <p className="mt-1 text-ink-muted">{day.data ? formatDay(day.data.forDate) : ''} · needs an internet connection</p>
        </div>
        {groupIds.length > 1 && <NativeSelect aria-label="Circle" data={groupIds.map((id) => ({ value: String(id), label: groupName(id) }))} value={String(groupId)} onChange={(e) => setChosen(Number(e.currentTarget.value))} />}
      </div>

      {day.isLoading ? <AjoLoading rows={2} /> : day.isError ? <AjoError error={day.error} onRetry={() => day.refetch()} /> : day.data && (
        <section className="grid gap-4 sm:grid-cols-4">
          {[['Expected today', day.data.expectedKobo], ['Collected today', day.data.collectedKobo], ['Carried over', day.data.carriedOverKobo], ['Cash in your hand', day.data.inHandKobo]].map(([label, kobo]) => (
            <div key={label} className="rounded-lg border border-line p-4"><p className="text-xs text-ink-faint">{label}</p><p className="text-xl font-semibold"><Money kobo={kobo} /></p></div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your contributors</h2>
        <ul className="divide-y divide-line-soft rounded-lg border border-line">
          {people.map((c) => {
            const arrears = day.data?.arrears.find((a) => a.membershipId === c.membershipId);
            return (
              <li key={c.assignmentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div><p className="font-medium">{c.name}</p>{arrears && koboPositive(arrears.overdueKobo) && <p className="text-xs text-danger">Behind by {arrears.overdue}</p>}</div>
                <div className="flex items-center gap-2">{paidToday.has(c.name) && <StatusBadge status="CASH_RECEIVED" label="Paid today" />}{canWrite && !alreadyHanded && <Button size="compact-sm" onClick={() => setCashFor(c)}>Record cash</Button>}</div>
              </li>
            );
          })}
        </ul>
      </section>

      {day.data && day.data.payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Recorded today</h2>
          <ul className="divide-y divide-line-soft rounded-lg border border-line text-sm">{day.data.payments.map((p) => <li key={p.contributionId} className="flex justify-between px-4 py-2"><span>{p.name}{p.reference ? ` · ${p.reference}` : ''}</span><Money kobo={p.amountKobo} /></li>)}</ul>
        </section>
      )}

      <section className="rounded-lg border border-line p-5">
        <h2 className="text-lg font-semibold">End of day handover</h2>
        {alreadyHanded ? (
          <p className="mt-2 text-sm text-ink-soft">You handed over <strong><Money kobo={day.data?.handedOverKobo} /></strong>{day.data?.handover?.reconciled ? '. An officer has counted and reconciled it.' : '. An officer still has to count it.'}{day.data && day.data.differenceKobo !== '0' ? <> The difference is <strong className="text-danger"><Money kobo={day.data.differenceKobo} /></strong>.</> : null}</p>
        ) : canWrite ? (
          <><p className="mt-1 text-sm text-ink-muted">When you give the cash to the circle, record how much you handed over. If it does not match what you collected, the difference is shown to the officer.</p><Button className="mt-3" color="green" onClick={() => setHanding(true)} disabled={!day.data}>Hand over cash</Button></>
        ) : <p className="mt-2 text-sm text-ink-muted">Handovers are switched off while the add-on is expired.</p>}
      </section>

      <RecordCashDialog person={cashFor} groupId={groupId} onClose={() => setCashFor(null)} />
      <Modal opened={handing} onClose={() => setHanding(false)} title="Hand over cash" centered size="sm">
        <div className="space-y-4">
          {day.data && <p className="text-sm text-ink-soft">You collected <strong><Money kobo={day.data.collectedKobo} /></strong>{koboPositive(day.data.carriedOverKobo) ? <> and carried over <strong><Money kobo={day.data.carriedOverKobo} /></strong></> : null}.</p>}
          <TextInput label="Cash you are handing over (₦)" inputMode="decimal" autoFocus value={handed} onChange={(e) => setHanded(e.currentTarget.value)} />
          <TextInput label="Note (optional)" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={() => setHanding(false)}>Cancel</Button><Button color="green" onClick={handOver} loading={busy}>Record handover</Button></div>
        </div>
      </Modal>
    </div>
  );
}
