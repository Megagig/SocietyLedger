'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { CoopButton } from '@/components/coop/CoopButton';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PAYMENT_METHODS, paymentError, useOpenCharges, useRecordPayments, type OpenCharge, type PaymentSource, type RecordedPayment } from '@/lib/finance/collections';
import { formatDate } from '@/utils/format';
import { ChargeName } from './ChargeName';

const fieldClass =
  'mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus disabled:cursor-not-allowed disabled:opacity-60';

const KIND_LABEL: Record<OpenCharge['kind'], string> = { levy: 'Levy', pledge: 'Pledge', penalty: 'Penalty', charge: 'Charge' };

const today = () => new Date().toISOString().slice(0, 10);

/** Today records the moment it happens; an earlier day records noon of that day, so it cannot slip into the day before in another time zone. */
const toDateTime = (day: string) => (day === today() ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString());

interface Props {
  opened: boolean;
  onClose: () => void;
  /** The member's database id (not the member number). */
  memberId: number | null;
  /** Shown instead of the member's name, for an anonymous donor. */
  memberLabel?: string;
  /** Which screen the officer is on; kept in the audit log. */
  source: PaymentSource;
  /** The one debt the officer clicked on. Left alone, every open debt is ticked at its full balance (the Member Ledger). */
  preselectTransactionId?: number;
  /** Called once the payments are saved, so the screen behind can refresh. */
  onRecorded?: () => void;
}

/**
 * Record a payment an officer has received. It lists everything the member still owes; the officer ticks what this payment settles and can
 * change an amount to a part payment. Everything ticked is saved together or not at all, and each debt gets its own receipt.
 */
export function RecordPaymentDialog({ opened, onClose, memberId, memberLabel, source, preselectTransactionId, onRecorded }: Props) {
  const charges = useOpenCharges(opened ? memberId : null);
  const record = useRecordPayments();

  const [picked, setPicked] = useState<Record<number, string>>({});
  const [method, setMethod] = useState('cash');
  const [day, setDay] = useState(today());
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<{ message: string; transactionId?: number } | null>(null);
  const [receipts, setReceipts] = useState<RecordedPayment[] | null>(null);

  // Start fresh whenever the dialog opens for a member, and tick the right debts once they have loaded.
  useEffect(() => {
    if (!opened) return;
    setMethod('cash');
    setDay(today());
    setNote('');
    setFailure(null);
    setReceipts(null);
    setPicked({});
  }, [opened, memberId, preselectTransactionId]);

  const data = charges.data;
  useEffect(() => {
    if (!opened || !data) return;
    const start: Record<number, string> = {};
    for (const charge of data.charges) {
      if (preselectTransactionId === undefined || charge.transactionId === preselectTransactionId) start[charge.transactionId] = String(charge.balance);
    }
    setPicked(start);
  }, [opened, data, preselectTransactionId]);

  const byId = useMemo(() => new Map((data?.charges ?? []).map((c) => [c.transactionId, c])), [data]);
  const lines = Object.entries(picked).map(([id, value]) => ({ transactionId: Number(id), amount: Number(value), charge: byId.get(Number(id)) }));
  const problem = (line: (typeof lines)[number]) => {
    if (!Number.isFinite(line.amount) || line.amount <= 0) return 'Enter an amount above zero.';
    if (line.charge && line.amount > line.charge.balance) return `At most ${line.charge.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`;
    return null;
  };
  const total = lines.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
  const invalid = lines.length === 0 || lines.some((l) => problem(l));

  const toggle = (charge: OpenCharge) =>
    setPicked((current) => {
      const next = { ...current };
      if (charge.transactionId in next) delete next[charge.transactionId];
      else next[charge.transactionId] = String(charge.balance);
      return next;
    });

  const submit = async () => {
    setFailure(null);
    try {
      const saved = await record.mutateAsync({
        items: lines.map((l) => ({ transactionId: l.transactionId, amountPaid: Math.round(l.amount * 100) / 100 })),
        paymentMethod: method,
        paymentDate: toDateTime(day),
        notes: note.trim() || undefined,
        source,
      });
      setReceipts(saved);
      onRecorded?.();
    } catch (error) {
      setFailure(paymentError(error));
    }
  };

  const canRecord = data?.canRecord !== false;

  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={receipts ? 'Payment recorded' : 'Record payment'} closeOnClickOutside={!record.isPending}>
      {receipts ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success-text">
            <IconCheck size={18} aria-hidden="true" /> {receipts.length === 1 ? 'The payment was saved.' : `All ${receipts.length} payments were saved.`}
          </p>
          <ul className="m-0 list-none divide-y divide-line rounded-md border border-line p-0">
            {receipts.map((r) => (
              <li key={r.paymentId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-ink">
                  {r.label}
                  <span className="block text-xs text-ink-muted">Receipt {r.receiptNumber}</span>
                </span>
                <span className="text-right">
                  <Naira value={r.amountPaid} />
                  <span className="block text-xs text-ink-muted">{r.transactionStatus === 'paid' ? 'Fully paid' : <>Still owes <Naira value={r.remainingBalance} /></>}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <CoopButton onClick={onClose}>Done</CoopButton>
          </div>
        </div>
      ) : charges.isLoading ? (
        <CoopLoading rows={3} height={56} />
      ) : charges.isError || !data ? (
        <CoopError error={charges.error} onRetry={() => charges.refetch()} />
      ) : data.charges.length === 0 ? (
        <div className="space-y-4">
          <CoopEmpty title="Nothing owing" hint={`${memberLabel ?? data.member.name} has no unpaid charges.`} />
          <div className="flex justify-end">
            <Button variant="default" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-ink">
              {memberLabel ?? data.member.name} {memberLabel ? null : <span className="font-normal text-ink-muted">({data.member.memberNumber})</span>}
            </p>
            <p className="text-sm text-ink-muted">
              Owes <Naira value={data.totalOwed} /> in total. Tick what this payment settles.
            </p>
          </div>

          {!canRecord && (
            <p role="alert" className="rounded-md border border-warning-line bg-warning-soft p-3 text-sm text-warning-strong">
              {data.reason ?? 'You cannot record this payment.'}
            </p>
          )}

          <ul className="m-0 list-none space-y-2 p-0" aria-label="What the member owes">
            {data.charges.map((charge) => {
              const on = charge.transactionId in picked;
              const line = lines.find((l) => l.transactionId === charge.transactionId);
              const error = line ? problem(line) : null;
              const refused = failure?.transactionId === charge.transactionId;
              return (
                <li key={charge.transactionId} className={`rounded-md border p-3 ${refused ? 'border-danger-line bg-danger-soft' : 'border-line bg-surface'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={on} disabled={!canRecord} onChange={() => toggle(charge)} className="h-5 w-5 accent-success" />
                      <span>
                        <span className="block text-sm font-medium text-ink"><ChargeName name={charge.category} purpose={charge.purpose} /></span>
                        <span className="block text-xs text-ink-muted">
                          {KIND_LABEL[charge.kind]}
                          {charge.dueDate ? ` · due ${formatDate(charge.dueDate)}` : ''}
                          {charge.paid > 0 ? ' · part paid' : ''}
                        </span>
                      </span>
                    </label>
                    <span className="text-right text-sm text-ink">
                      <span className="block text-xs text-ink-muted">Balance</span>
                      <Naira value={charge.balance} />
                    </span>
                  </div>
                  {on && (
                    <label className="mt-2 block text-sm font-medium text-ink-soft">
                      Amount received
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={picked[charge.transactionId]}
                        disabled={!canRecord}
                        onChange={(e) => setPicked((current) => ({ ...current, [charge.transactionId]: e.target.value }))}
                        aria-invalid={!!error}
                        className={fieldClass}
                      />
                      {error && <span className="mt-1 block text-xs text-danger-text">{error}</span>}
                    </label>
                  )}
                  {refused && failure && <p role="alert" className="mt-2 text-xs text-danger-text">{failure.message}</p>}
                </li>
              );
            })}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-soft">
              How was it paid?
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={!canRecord} className={fieldClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-soft">
              Date received
              <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} disabled={!canRecord} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm font-medium text-ink-soft">
            Note (optional)
            <input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={!canRecord} className={fieldClass} />
          </label>

          {failure && !failure.transactionId && (
            <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger-text">
              {failure.message}
            </p>
          )}
          {failure?.transactionId && (
            <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger-text">
              Nothing was saved. Fix the debt marked above and try again.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-sm text-ink-muted">
              Recording <Naira value={total} /> across {lines.length} {lines.length === 1 ? 'debt' : 'debts'}
            </p>
            <div className="flex gap-2">
              <Button variant="default" onClick={onClose} disabled={record.isPending}>Cancel</Button>
              <CoopButton onClick={submit} loading={record.isPending} disabled={!canRecord || invalid}>
                Record payment
              </CoopButton>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
