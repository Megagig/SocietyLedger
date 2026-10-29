'use client';

import { useState } from 'react';
import { Badge, Button, Progress, Tabs } from '@mantine/core';
import { IconCheck, IconCircleDashed, IconDownload } from '@tabler/icons-react';
import { DisputeDialog } from '@/components/ajo/DisputeDialog';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusChip } from '@/components/ajo/board/BoardParts';
import { formatDay, formatKobo, koboPositive } from '@/lib/ajo/format';
import type { InstallmentDTO } from '@/lib/ajo/types';
import { downloadFile, useCashTracker, useCollectorInfo, useSavings, useSavingsPayments, useSavingsRecord, type CashTrackerDTO, type SavingsDTO } from '@/lib/ajo/savingsHooks';
import { toast } from '@/lib/toast';

const when = (iso: string | null | undefined, timeZone: string) => (iso ? new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone }) : '');

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-line p-5">
      {title ? <h3 className="text-base font-semibold text-ink">{title}</h3> : null}
      {children}
    </section>
  );
}

const PAYOUT_TEXT: Record<SavingsDTO['payout']['state'], string> = { UPCOMING: 'Upcoming', PREPARED: 'Prepared', APPROVED: 'Approved', PAID: 'Paid', HELD: 'Held', CONTINUING: 'Your savings stay in the group' };

/** 5.1 My savings, with the calendar (5.2). */
function SummaryTab({ membershipId }: { membershipId: number }) {
  const q = useSavings(membershipId);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const pct = s.progress.total > 0 ? Math.round((s.progress.made / s.progress.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Saved so far">
          <p className="text-3xl font-bold tabular-nums"><Money kobo={s.saved.savedKobo} /></p>
          {koboPositive(s.saved.carriedKobo) && <p className="text-sm text-ink-muted">Plus <Money kobo={s.saved.carriedKobo} /> brought forward from your last cycle.</p>}
          {koboPositive(s.saved.reportedKobo) && <p className="text-sm text-ink-muted">Reported, awaiting confirmation: <Money kobo={s.saved.reportedKobo} /></p>}
          <p className="text-sm text-ink">{s.pace.upToDate ? "You're up to date." : `You're behind by ${formatKobo(s.pace.behindKobo)}.`}</p>
        </Card>
        <Card title="Your progress">
          <Progress value={pct} color="green" size="lg" radius="xl" aria-label="Payments made this cycle" />
          <p className="text-sm text-ink">
            {s.progress.total} payments in this cycle · {s.progress.made} made · {s.progress.missed} missed · {s.progress.toGo} to go
          </p>
          <p className="text-xs text-ink-muted">You save <Money kobo={s.amountKobo} /> {s.cadence}. Cycle {s.cycleNo} runs {formatDay(s.startsOn)} to {s.endsOn ? formatDay(s.endsOn) : ''}.</p>
        </Card>
      </div>

      <Card title="What you will receive">
        <p className="text-lg font-semibold tabular-nums">{s.receive.text}</p>
        <p className="text-sm text-ink-muted">Collector fee: {s.receive.feeText}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <Badge color={s.payout.state === 'PAID' ? 'green' : s.payout.state === 'HELD' ? 'yellow' : 'gray'} variant="light">{PAYOUT_TEXT[s.payout.state]}</Badge>
          {s.receive.cycleEnds && <span>Cycle ends {formatDay(s.receive.cycleEnds)}.</span>}
          {s.payout.paidAt && <span>Paid {when(s.payout.paidAt, s.timezone)}{s.payout.referenceLast4 ? `, ref ••${s.payout.referenceLast4}` : ''}.</span>}
          {s.payout.holdReason && <span className="text-warning-strong">{s.payout.holdReason}</span>}
        </div>
      </Card>

      <Card title="Your calendar">
        <ul className="divide-y divide-line-soft">
          {s.calendar.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="w-28 text-ink">{formatDay(d.dueDate)}</span>
              <span className="tabular-nums"><Money kobo={d.amountKobo} /></span>
              <StatusChip status={d.status} label={d.label} graceEndsOn={d.graceEndsOn} />
              <span className="w-28 text-right text-xs text-ink-muted">{d.datePaid ? `Paid ${formatDay(d.datePaid)}` : ''}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** 5.3 Payment history, with a receipt for each confirmed payment. */
function PaymentsTab({ membershipId }: { membershipId: number }) {
  const q = useSavingsPayments(membershipId);
  const [busy, setBusy] = useState<number | null>(null);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.payments.length === 0) return <AjoEmpty title="No payments yet." hint="Each payment you make appears here with its receipt." />;
  const tz = q.data.timezone;

  const receipt = async (id: number) => {
    setBusy(id);
    try {
      await downloadFile(`/ajo/contributions/${id}/receipt.pdf`, `receipt-${id}.pdf`);
    } catch {
      toast.error('Could not download the receipt. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-ink-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 font-medium">How</th>
            <th className="px-4 py-2 font-medium">Recorded by</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Receipt</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {q.data.payments.map((p) => (
            <tr key={p.id} className="border-t border-line-soft">
              <td className="px-4 py-2">{when(p.receivedAt, tz)}</td>
              <td className="px-4 py-2 text-right"><Money kobo={p.amountKobo} /></td>
              <td className="px-4 py-2">{p.method === 'CASH' ? 'Cash to collector' : 'Bank transfer'}</td>
              <td className="px-4 py-2">{p.recordedBy}</td>
              <td className="px-4 py-2">{p.label}{p.confirmedAt ? <span className="block text-xs text-ink-muted">{when(p.confirmedAt, tz)}</span> : null}</td>
              <td className="px-4 py-2 tabular-nums">{p.receiptNumber}</td>
              <td className="px-4 py-2">
                {p.canDownloadReceipt && <Button size="compact-xs" variant="subtle" leftSection={<IconDownload size={12} />} loading={busy === p.id} onClick={() => receipt(p.id)}>Receipt</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEP_DONE = 'text-success';

function Step({ done, late, title, detail }: { done: boolean; late?: boolean; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? <IconCheck size={16} className={`mt-0.5 ${STEP_DONE}`} aria-hidden /> : <IconCircleDashed size={16} className={`mt-0.5 ${late ? 'text-warning' : 'text-ink-faint'}`} aria-hidden />}
      <span>
        <span className="font-medium text-ink">{title}</span>
        <span className={late ? 'block text-warning-strong' : 'block text-ink-muted'}>{detail}</span>
      </span>
    </li>
  );
}

/** 5.4 Where my cash is: three steps per cash payment, and a one-tap question when one is late. */
function CashTab({ membershipId }: { membershipId: number }) {
  const q = useCashTracker(membershipId);
  const savings = useSavings(membershipId);
  const [asking, setAsking] = useState<InstallmentDTO | null>(null);
  if (q.isLoading) return <AjoLoading rows={3} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const t: CashTrackerDTO = q.data;
  if (t.payments.length === 0) return <AjoEmpty title="No cash payments yet." hint="When you give cash to your collector, you can follow it here, from their hand to the office." />;

  const ask = (installmentId: number | null) => {
    const day = savings.data?.calendar.find((d) => d.id === installmentId);
    if (!day) return toast.error('There is no payment to ask about right now.');
    setAsking({ id: day.id, dueDate: day.dueDate, amountKobo: day.amountKobo, paidKobo: day.paidKobo, status: 'DUE', pastDue: true });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Each cash payment goes through three steps. If one takes too long (a day for your collector, two for the office), it says so and you can ask about it.</p>
      {t.payments.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold tabular-nums"><Money kobo={p.amountKobo} /></p>
            {p.stage === 'CONFIRMED' && <Badge color="green" variant="light">Confirmed by the office</Badge>}
            {p.stage === 'REVERSED' && <Badge color="gray" variant="light">Reversed</Badge>}
            {p.stage === 'REJECTED' && <Badge color="red" variant="light">Turned down</Badge>}
          </div>
          <ol className="space-y-2">
            <Step done title="Your collector recorded it" detail={`${p.recorded.by}, ${when(p.recorded.at, t.timezone)}`} />
            <Step done={!!p.handedIn} late={p.late?.step === 'HANDED_IN'} title="Your collector handed it in" detail={p.handedIn ? when(p.handedIn.at, t.timezone) : p.late?.step === 'HANDED_IN' ? p.late.text : 'Not yet handed in'} />
            <Step done={!!p.confirmed} late={p.late?.step === 'CONFIRMED'} title="The office confirmed it" detail={p.confirmed ? `${p.confirmed.by}, ${when(p.confirmed.at, t.timezone)}` : p.late?.step === 'CONFIRMED' ? p.late.text : 'Waiting for the office'} />
          </ol>
          {p.late && <Button size="xs" color="yellow" variant="light" onClick={() => ask(p.queryInstallmentId)}>Ask about this payment</Button>}
        </Card>
      ))}
      <DisputeDialog membershipId={membershipId} installment={asking} onClose={() => setAsking(null)} />
    </div>
  );
}

/** 5.5 My collector, 5.6 fees and charges. */
function CollectorTab({ membershipId }: { membershipId: number }) {
  const q = useCollectorInfo(membershipId);
  if (q.isLoading) return <AjoLoading rows={2} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { collector, fee } = q.data;
  return (
    <div className="space-y-4">
      <Card title="My collector">
        {collector ? (
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted font-semibold text-ink" aria-hidden>{collector.initials}</span>
            <div className="text-sm">
              <p className="text-base font-semibold text-ink">{collector.name}</p>
              {collector.phone && <p className="text-ink-muted">{collector.phone}</p>}
              <p className="text-ink-muted">Your collector since {formatDay(collector.since)}{collector.dailyTargetKobo ? ` · daily target ${formatKobo(collector.dailyTargetKobo)}` : ''}</p>
              {collector.lastVisitAt && <p className="text-ink-muted">Last cash taken {when(collector.lastVisitAt, 'Africa/Lagos')}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">You do not have a collector at the moment. You can pay by bank transfer, or ask an officer to assign one.</p>
        )}
      </Card>
      <Card title="Fees and charges">
        <p className="text-sm text-ink">Collector fee: {fee.text}</p>
        <p className="text-xs text-ink-muted">It comes out of your savings when the cycle ends. Any late fee shows on your circle page with the date, reason and amount.</p>
      </Card>
    </div>
  );
}

/** 5.7 My record, with past cycles. */
function RecordTab({ membershipId }: { membershipId: number }) {
  const q = useSavingsRecord(membershipId);
  if (q.isLoading) return <AjoLoading rows={2} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  return (
    <div className="space-y-4">
      <Card title="My record">
        <p className="text-sm text-ink">{r.trust.text}</p>
        <p className="text-sm text-ink">{r.streak > 0 ? `${r.streak} payment${r.streak === 1 ? '' : 's'} on time in a row.` : 'No streak yet.'}</p>
        <p className="text-xs text-ink-muted">Only you and the group&apos;s officers can see this.</p>
      </Card>
      <Card title="Past cycles">
        {r.pastCycles.length === 0 ? (
          <p className="text-sm text-ink-muted">Your first cycle has not finished yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-muted"><tr><th className="py-2 pr-4 font-medium">Cycle</th><th className="py-2 pr-4 text-right font-medium">Saved</th><th className="py-2 pr-4 text-right font-medium">Fee</th><th className="py-2 pr-4 text-right font-medium">Received</th><th className="py-2 font-medium">Paid</th></tr></thead>
              <tbody>
                {r.pastCycles.map((c) => (
                  <tr key={c.cycleNo} className="border-t border-line-soft">
                    <td className="py-2 pr-4">{c.cycleNo}</td>
                    <td className="py-2 pr-4 text-right"><Money kobo={c.savedKobo} /></td>
                    <td className="py-2 pr-4 text-right"><Money kobo={c.feeKobo} /></td>
                    <td className="py-2 pr-4 text-right">{c.receivedKobo ? <Money kobo={c.receivedKobo} /> : c.choice === 'CONTINUE' ? 'Carried forward' : ''}</td>
                    <td className="py-2">{c.payoutDate ? formatDay(c.payoutDate) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** 5.8 Statements. */
function StatementsTab({ membershipId }: { membershipId: number }) {
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const get = async (format: 'pdf' | 'csv') => {
    setBusy(format);
    try {
      await downloadFile(`/ajo/memberships/${membershipId}/statement?format=${format}`, `statement.${format}`);
    } catch {
      toast.error('Could not make the statement. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card title="My statement">
      <p className="text-sm text-ink-muted">Everything for the cycle you are in: what fell due, every payment, your savings and what you will receive. From SocietyLedger&apos;s records; your group&apos;s bank statement is the final word.</p>
      <div className="flex flex-wrap gap-3">
        <Button color="green" leftSection={<IconDownload size={14} />} loading={busy === 'pdf'} onClick={() => get('pdf')}>Download PDF</Button>
        <Button variant="default" leftSection={<IconDownload size={14} />} loading={busy === 'csv'} onClick={() => get('csv')}>Download CSV</Button>
      </div>
      <p className="text-xs text-ink-muted">Paid but it is not showing? Open the Payments tab to check, or &quot;Where my cash is&quot; for cash you gave your collector.</p>
    </Card>
  );
}

/** A collector-thrift saver's own view of their savings (spec §16.6). */
export function SavingsView({ membershipId }: { membershipId: number }) {
  return (
    <Tabs defaultValue="savings" keepMounted={false}>
      <Tabs.List className="mb-5 flex-wrap">
        <Tabs.Tab value="savings">My savings</Tabs.Tab>
        <Tabs.Tab value="payments">Payments</Tabs.Tab>
        <Tabs.Tab value="cash">Where my cash is</Tabs.Tab>
        <Tabs.Tab value="collector">Collector and fees</Tabs.Tab>
        <Tabs.Tab value="record">My record</Tabs.Tab>
        <Tabs.Tab value="statements">Statements</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="savings"><SummaryTab membershipId={membershipId} /></Tabs.Panel>
      <Tabs.Panel value="payments"><PaymentsTab membershipId={membershipId} /></Tabs.Panel>
      <Tabs.Panel value="cash"><CashTab membershipId={membershipId} /></Tabs.Panel>
      <Tabs.Panel value="collector"><CollectorTab membershipId={membershipId} /></Tabs.Panel>
      <Tabs.Panel value="record"><RecordTab membershipId={membershipId} /></Tabs.Panel>
      <Tabs.Panel value="statements"><StatementsTab membershipId={membershipId} /></Tabs.Panel>
    </Tabs>
  );
}
