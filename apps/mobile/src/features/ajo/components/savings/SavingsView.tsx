import { Check, CircleDashed } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoSavingsApi } from '@/api/endpoints/ajoSavings';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { InstallmentDTO } from '@/types/api/ajo';
import type { SavingsDTO } from '@/types/api/ajoSavings';
import { formatMomentIn, shortDay } from '../../boardFormat';
import { formatDay, formatKobo, koboPositive } from '../../format';
import { useCashTracker, useCollectorInfo, useSavings, useSavingsPayments, useSavingsRecord } from '../../savingsQueries';
import { CSV_MIME, PDF_MIME, saveAndShareFile } from '../../shareFile';
import { AjoMoney } from '../AjoMoney';
import { AjoLoading } from '../AjoStates';
import { BoardCard, FactRow, StatusPill } from '../board/BoardParts';
import { DisputeSheet, type DisputeSheetHandle } from '../DisputeSheet';

type QueryLike = { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
function Gate({ q, children }: { q: QueryLike; children: () => React.ReactNode }) {
  if (q.isPending) return <AjoLoading rows={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <>{children()}</>;
}

const PAYOUT_TEXT: Record<SavingsDTO['payout']['state'], string> = { UPCOMING: 'Upcoming', PREPARED: 'Prepared', APPROVED: 'Approved', PAID: 'Paid', HELD: 'Held', CONTINUING: 'Your savings stay in the group' };

/** 5.1 My savings with the calendar (5.2). */
function SummaryView({ membershipId }: { membershipId: number }) {
  const q = useSavings(membershipId);
  return (
    <Gate q={q}>
      {() => {
        const s = q.data;
        if (!s) return null;
        const pct = s.progress.total > 0 ? Math.round((s.progress.made / s.progress.total) * 100) : 0;
        return (
          <View className="gap-3" testID="savings-summary">
            <BoardCard title="Saved so far">
              <Text variant="h1">{formatKobo(s.saved.savedKobo)}</Text>
              {koboPositive(s.saved.carriedKobo) ? (
                <Text variant="caption" tone="secondary">
                  Plus {formatKobo(s.saved.carriedKobo)} brought forward from your last cycle.
                </Text>
              ) : null}
              {koboPositive(s.saved.reportedKobo) ? (
                <Text variant="caption" tone="secondary">
                  Reported, awaiting confirmation: {formatKobo(s.saved.reportedKobo)}
                </Text>
              ) : null}
              <Text variant="body">{s.pace.upToDate ? "You're up to date." : `You're behind by ${formatKobo(s.pace.behindKobo)}.`}</Text>
            </BoardCard>

            <BoardCard title="Your progress">
              <ProgressBar percent={pct} tone="success" label="Payments made this cycle" />
              <Text variant="body">
                {s.progress.total} payments in this cycle · {s.progress.made} made · {s.progress.missed} missed · {s.progress.toGo} to go
              </Text>
              <Text variant="caption" tone="secondary">
                You save {formatKobo(s.amountKobo)} {s.cadence}. Cycle {s.cycleNo} runs {formatDay(s.startsOn)}
                {s.endsOn ? ` to ${formatDay(s.endsOn)}` : ''}.
              </Text>
            </BoardCard>

            <BoardCard title="What you will receive">
              <Text variant="body-strong">{s.receive.text}</Text>
              <Text variant="caption" tone="secondary">
                Collector fee: {s.receive.feeText}
              </Text>
              <Text variant="body">
                {PAYOUT_TEXT[s.payout.state]}
                {s.receive.cycleEnds ? ` · cycle ends ${formatDay(s.receive.cycleEnds)}` : ''}
                {s.payout.paidAt ? ` · paid ${formatMomentIn(s.payout.paidAt, s.timezone)}${s.payout.referenceLast4 ? `, ref ••${s.payout.referenceLast4}` : ''}` : ''}
              </Text>
              {s.payout.holdReason ? (
                <Text variant="caption" tone="warning">
                  {s.payout.holdReason}
                </Text>
              ) : null}
            </BoardCard>

            <BoardCard title="Your calendar">
              {s.calendar.map((d) => (
                <View key={d.id} className="flex-row items-center justify-between gap-2" testID={`savings-day-${d.id}`}>
                  <View className="flex-1 gap-1">
                    <Text variant="body-strong">{shortDay(d.dueDate)}</Text>
                    <StatusPill status={d.status} label={d.label} graceEndsOn={d.graceEndsOn} />
                  </View>
                  <View className="items-end">
                    <AjoMoney kobo={d.amountKobo} />
                    {d.datePaid ? (
                      <Text variant="caption" tone="tertiary">
                        Paid {shortDay(d.datePaid)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </BoardCard>
          </View>
        );
      }}
    </Gate>
  );
}

/** 5.3 Payment history with a receipt for each confirmed payment. */
function PaymentsView({ membershipId }: { membershipId: number }) {
  const q = useSavingsPayments(membershipId);
  const [busy, setBusy] = useState<number | null>(null);
  const receipt = async (id: number) => {
    setBusy(id);
    try {
      await saveAndShareFile(`receipt-${id}.pdf`, await ajoSavingsApi.file(`/ajo/contributions/${id}/receipt.pdf`), PDF_MIME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not get the receipt.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        if (d.payments.length === 0) return <EmptyState title="No payments yet." description="Each payment you make appears here with its receipt." />;
        return (
          <View className="gap-3" testID="savings-payments">
            {d.payments.map((p) => (
              <BoardCard key={p.id}>
                <View className="flex-row items-start justify-between gap-2">
                  <Text variant="body-strong" className="flex-1">
                    {formatMomentIn(p.receivedAt, d.timezone)}
                  </Text>
                  <AjoMoney kobo={p.amountKobo} />
                </View>
                <Text variant="caption" tone="secondary">
                  {p.method === 'CASH' ? 'Cash to collector' : 'Bank transfer'} · recorded by {p.recordedBy} · {p.label}
                  {p.confirmedAt ? ` · confirmed ${formatMomentIn(p.confirmedAt, d.timezone)}` : ''}
                </Text>
                <Text variant="caption" tone="tertiary">
                  Receipt {p.receiptNumber}
                </Text>
                {p.canDownloadReceipt ? (
                  <Button size="sm" variant="secondary" loading={busy === p.id} onPress={() => void receipt(p.id)} testID={`savings-receipt-${p.id}`}>
                    Download receipt
                  </Button>
                ) : null}
              </BoardCard>
            ))}
          </View>
        );
      }}
    </Gate>
  );
}

function Step({ done, late, title, detail }: { done: boolean; late?: boolean; title: string; detail: string }) {
  const { color } = useThemeTokens();
  return (
    <View className="flex-row items-start gap-2">
      {done ? <Check size={16} color={color.success} strokeWidth={2.25} /> : <CircleDashed size={16} color={late ? color.warning : color.textTertiary} strokeWidth={2} />}
      <View className="flex-1">
        <Text variant="body-strong">{title}</Text>
        <Text variant="caption" tone={late ? 'warning' : 'secondary'}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** 5.4 Where my cash is: three steps per cash payment, and a one-tap question when one is late. */
function CashView({ membershipId }: { membershipId: number }) {
  const q = useCashTracker(membershipId);
  const savings = useSavings(membershipId);
  const sheet = useRef<DisputeSheetHandle>(null);
  const ask = (installmentId: number | null) => {
    const day = savings.data?.calendar.find((d) => d.id === installmentId);
    if (!day) {
      toast.error('There is no payment to ask about right now.');
      return;
    }
    const item: InstallmentDTO = { id: day.id, dueDate: day.dueDate, amountKobo: day.amountKobo, paidKobo: day.paidKobo, status: 'DUE', pastDue: true };
    sheet.current?.open(item);
  };
  return (
    <Gate q={q}>
      {() => {
        const t = q.data;
        if (!t) return null;
        if (t.payments.length === 0) return <EmptyState title="No cash payments yet." description="When you give cash to your collector, you can follow it here, from their hand to the office." />;
        return (
          <View className="gap-3" testID="savings-cash">
            <Text variant="caption" tone="secondary">
              Each cash payment goes through three steps. If one takes too long (a day for your collector, two for the office), it says so and you can ask about it.
            </Text>
            {t.payments.map((p) => (
              <BoardCard key={p.id}>
                <View className="flex-row items-center justify-between gap-2">
                  <AjoMoney kobo={p.amountKobo} />
                  <Text variant="caption" tone={p.stage === 'CONFIRMED' ? 'success' : 'secondary'}>
                    {p.stage === 'CONFIRMED' ? 'Confirmed by the office' : p.stage === 'REVERSED' ? 'Reversed' : p.stage === 'REJECTED' ? 'Turned down' : ''}
                  </Text>
                </View>
                <Step done title="Your collector recorded it" detail={`${p.recorded.by}, ${formatMomentIn(p.recorded.at, t.timezone)}`} />
                <Step done={!!p.handedIn} late={p.late?.step === 'HANDED_IN'} title="Your collector handed it in" detail={p.handedIn ? formatMomentIn(p.handedIn.at, t.timezone) : (p.late?.step === 'HANDED_IN' ? p.late.text : 'Not yet handed in')} />
                <Step done={!!p.confirmed} late={p.late?.step === 'CONFIRMED'} title="The office confirmed it" detail={p.confirmed ? `${p.confirmed.by}, ${formatMomentIn(p.confirmed.at, t.timezone)}` : (p.late?.step === 'CONFIRMED' ? p.late.text : 'Waiting for the office')} />
                {p.late ? (
                  <Button size="sm" variant="secondary" onPress={() => ask(p.queryInstallmentId)} testID={`savings-ask-${p.id}`}>
                    Ask about this payment
                  </Button>
                ) : null}
              </BoardCard>
            ))}
            <DisputeSheet ref={sheet} membershipId={membershipId} />
          </View>
        );
      }}
    </Gate>
  );
}

/** 5.5 My collector and 5.6 fees. */
function CollectorView({ membershipId }: { membershipId: number }) {
  const q = useCollectorInfo(membershipId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        return (
          <View className="gap-3" testID="savings-collector">
            <BoardCard title="My collector">
              {d.collector ? (
                <View className="gap-1">
                  <Text variant="body-strong">{d.collector.name}</Text>
                  {d.collector.phone ? <Text variant="body">{d.collector.phone}</Text> : null}
                  <Text variant="caption" tone="secondary">
                    Your collector since {formatDay(d.collector.since)}
                    {d.collector.dailyTargetKobo ? ` · daily target ${formatKobo(d.collector.dailyTargetKobo)}` : ''}
                  </Text>
                  {d.collector.lastVisitAt ? (
                    <Text variant="caption" tone="secondary">
                      Last cash taken {formatMomentIn(d.collector.lastVisitAt, 'Africa/Lagos')}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text variant="body" tone="secondary">
                  You do not have a collector at the moment. You can pay by bank transfer, or ask an officer to assign one.
                </Text>
              )}
            </BoardCard>
            <BoardCard title="Fees and charges">
              <Text variant="body">Collector fee: {d.fee.text}</Text>
              <Text variant="caption" tone="secondary">
                It comes out of your savings when the cycle ends. Any late fee shows on your circle page with the date, reason and amount.
              </Text>
            </BoardCard>
          </View>
        );
      }}
    </Gate>
  );
}

/** 5.7 My record, with past cycles. */
function RecordView({ membershipId }: { membershipId: number }) {
  const q = useSavingsRecord(membershipId);
  return (
    <Gate q={q}>
      {() => {
        const r = q.data;
        if (!r) return null;
        return (
          <View className="gap-3" testID="savings-record">
            <BoardCard title="My record">
              <Text variant="body">{r.trust.text}</Text>
              <Text variant="body">{r.streak > 0 ? `${r.streak} payment${r.streak === 1 ? '' : 's'} on time in a row.` : 'No streak yet.'}</Text>
              <Text variant="caption" tone="tertiary">
                Only you and the group&apos;s officers can see this.
              </Text>
            </BoardCard>
            <BoardCard title="Past cycles">
              {r.pastCycles.length === 0 ? (
                <Text variant="body" tone="secondary">
                  Your first cycle has not finished yet.
                </Text>
              ) : (
                r.pastCycles.map((c) => (
                  <View key={c.cycleNo} className="gap-1">
                    <Text variant="body-strong">Cycle {c.cycleNo}</Text>
                    <FactRow label="Saved">
                      <AjoMoney kobo={c.savedKobo} />
                    </FactRow>
                    <FactRow label="Collector fee">
                      <AjoMoney kobo={c.feeKobo} />
                    </FactRow>
                    <FactRow label="Received">{c.receivedKobo ? <AjoMoney kobo={c.receivedKobo} /> : <Text variant="body">{c.choice === 'CONTINUE' ? 'Carried forward' : ''}</Text>}</FactRow>
                    {c.payoutDate ? (
                      <Text variant="caption" tone="secondary">
                        Paid {formatDay(c.payoutDate)}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </BoardCard>
          </View>
        );
      }}
    </Gate>
  );
}

/** 5.8 Statements. */
function StatementsView({ membershipId }: { membershipId: number }) {
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const get = async (format: 'pdf' | 'csv') => {
    setBusy(format);
    try {
      await saveAndShareFile(`statement.${format}`, await ajoSavingsApi.file(`/ajo/memberships/${membershipId}/statement?format=${format}`), format === 'pdf' ? PDF_MIME : CSV_MIME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not make the statement.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <BoardCard title="My statement" testID="savings-statements">
      <Text variant="body" tone="secondary">
        Everything for the cycle you are in: what fell due, every payment, your savings and what you will receive. From SocietyLedger&apos;s records; your group&apos;s bank statement is the final word.
      </Text>
      <Button loading={busy === 'pdf'} onPress={() => void get('pdf')} testID="savings-statement-pdf">
        Share PDF
      </Button>
      <Button variant="secondary" loading={busy === 'csv'} onPress={() => void get('csv')} testID="savings-statement-csv">
        Share CSV
      </Button>
      <Text variant="caption" tone="tertiary">
        Paid but it is not showing? Check Payments, or Where my cash is for cash you gave your collector.
      </Text>
    </BoardCard>
  );
}

type ViewKey = 'savings' | 'payments' | 'cash' | 'collector' | 'record' | 'statements';
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'savings', label: 'My savings' },
  { key: 'payments', label: 'Payments' },
  { key: 'cash', label: 'Where my cash is' },
  { key: 'collector', label: 'Collector' },
  { key: 'record', label: 'My record' },
  { key: 'statements', label: 'Statements' },
];

/** A collector-thrift saver's own view of their savings (spec §16.6). */
export function SavingsView({ membershipId }: { membershipId: number }) {
  const [view, setView] = useState<ViewKey>('savings');
  return (
    <View className="gap-4" testID="savings-view">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
        {VIEWS.map((v) => (
          <FilterChip key={v.key} label={v.label} active={v.key === view} onPress={() => setView(v.key)} />
        ))}
      </ScrollView>
      {view === 'savings' ? <SummaryView membershipId={membershipId} /> : null}
      {view === 'payments' ? <PaymentsView membershipId={membershipId} /> : null}
      {view === 'cash' ? <CashView membershipId={membershipId} /> : null}
      {view === 'collector' ? <CollectorView membershipId={membershipId} /> : null}
      {view === 'record' ? <RecordView membershipId={membershipId} /> : null}
      {view === 'statements' ? <StatementsView membershipId={membershipId} /> : null}
    </View>
  );
}
