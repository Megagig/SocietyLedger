import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Divider } from '@/components/ui/Divider';
import { FilterChip } from '@/components/ui/FilterChip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { PaymentStatus } from '@/types/api/ajoBoard';
import { collectedPercent, daysPhrase, formatMomentIn, percent, shortDay } from '../../boardFormat';
import { useBoardActivity, useBoardArrears, useBoardMatrix, useBoardMembers, useBoardMetrics, useBoardOverview, useBoardPayouts, useBoardRound } from '../../boardQueries';
import { formatDay, formatKobo } from '../../format';
import { AjoMoney } from '../AjoMoney';
import { AjoLoading } from '../AjoStates';
import { BoardCard, FactRow, StatusPill, StatusSquare } from './BoardParts';

const PAYOUT_LABEL = { UPCOMING: 'Upcoming', PREPARED: 'Prepared', APPROVED: 'Approved', PAID: 'Paid', HELD: 'Held' } as const;

type QueryLike = { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
/** Loading, failed, or ready: the same three-way every view makes. */
function Gate({ q, children }: { q: QueryLike; children: () => React.ReactNode }) {
  if (q.isPending) return <AjoLoading rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <>{children()}</>;
}

// ── 4.1 Overview ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function OverviewView({ groupId }: { groupId: number }) {
  const q = useBoardOverview(groupId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        const { header, thisRound: r, upNext, you, health } = d;
        const c = r.counts;
        return (
          <View className="gap-4" testID="board-overview">
            <View className="gap-1">
              <Text variant="h2">{header.name}</Text>
              <Text variant="caption" tone="secondary">
                Round {header.round} of {header.totalRounds} · {formatKobo(header.contributionPerShareKobo)} per share, {header.cadence} · {formatDay(header.startDate)}
                {header.endsOn ? ` to ${formatDay(header.endsOn)}` : ''} · times in {header.timezone}
              </Text>
            </View>

            <BoardCard title={`This round${r.dueDate ? `, due ${shortDay(r.dueDate)}${r.dueIn ? ` (${r.dueIn})` : ''}` : ''}`}>
              <ProgressBar percent={collectedPercent(r.collectedKobo, r.expectedKobo)} tone="success" label="Collected this round" />
              <Text variant="body">
                {formatKobo(r.collectedKobo)} of {formatKobo(r.expectedKobo)} collected ({r.paidCount} of {r.expectedCount} paid)
              </Text>
              <Text variant="caption" tone="secondary">
                Paid {c.PAID_ON_TIME + c.PAID_LATE} · Reported {c.REPORTED} · Due {c.DUE} · Overdue {c.OVERDUE + c.MISSED}
                {c.UNDER_REVIEW ? ` · Under review ${c.UNDER_REVIEW}` : ''}
              </Text>
            </BoardCard>

            <BoardCard title="Up next">
              {upNext ? (
                <View className="gap-1">
                  <Text variant="body-strong">
                    {upNext.isYou ? 'You' : upNext.recipient} · position {upNext.position}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {upNext.scheduledOn ? `Scheduled ${shortDay(upNext.scheduledOn)}` : 'No date yet'} · {PAYOUT_LABEL[upNext.status]}
                  </Text>
                  {upNext.holdReason ? (
                    <Text variant="caption" tone="warning">
                      {upNext.holdReason}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text variant="body" tone="secondary">
                  The payout order has not been drawn yet.
                </Text>
              )}
            </BoardCard>

            {you ? (
              <BoardCard title="You">
                <View className="flex-row flex-wrap items-center gap-2">
                  {you.thisRound ? <StatusPill status={you.thisRound.status} label={you.thisRound.label} graceEndsOn={you.thisRound.graceEndsOn} /> : null}
                </View>
                <Text variant="body">{you.upToDate ? "You're up to date." : `You're behind by ${formatKobo(you.behindKobo)}.`}</Text>
                {you.positions.length > 0 ? (
                  <Text variant="caption" tone="secondary">
                    {you.positions.map((p) => `Your turn: round ${p.position}${p.scheduledOn ? `, ${shortDay(p.scheduledOn)}` : ''}`).join(' · ')}
                  </Text>
                ) : null}
              </BoardCard>
            ) : null}

            <View className="flex-row gap-3">
              <StatTile label="Collected this round" value={percent(health.collectionBps)} tone="success" />
              <StatTile label="Paid on time" value={percent(health.onTimeBps)} tone="info" />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="Rounds completed" value={`${health.roundsCompleted} of ${health.totalRounds}`} tone="primary" />
              <StatTile label={`Payouts recorded (${health.payoutsRecordedCount})`} value={formatKobo(health.payoutsRecordedKobo)} tone="accent" />
            </View>
            {d.visibility.anonymisedUntilAccepted ? (
              <Text variant="caption" tone="tertiary">
                Members who have not yet accepted the circle board rule show as &quot;Member&quot; and a number.
              </Text>
            ) : null}
          </View>
        );
      }}
    </Gate>
  );
}

// ── 4.2 This round ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function RoundView({ groupId }: { groupId: number }) {
  const overview = useBoardOverview(groupId);
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'NOT_PAID'>('ALL');
  const round = picked ?? overview.data?.header.round ?? 1;
  const total = overview.data?.header.totalRounds ?? 0;
  const q = useBoardRound(groupId, round, filter);

  return (
    <View className="gap-3" testID="board-round">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <FilterChip key={n} label={`Round ${n}${overview.data && n === overview.data.header.round ? ' (now)' : ''}`} active={n === round} onPress={() => setPicked(n)} />
        ))}
      </ScrollView>
      <View className="flex-row gap-2">
        <FilterChip label="All" active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
        <FilterChip label="Paid" active={filter === 'PAID'} onPress={() => setFilter('PAID')} />
        <FilterChip label="Not yet paid" active={filter === 'NOT_PAID'} onPress={() => setFilter('NOT_PAID')} />
      </View>
      <Gate q={q}>
        {() => {
          const d = q.data;
          if (!d) return null;
          if (d.people.length === 0) return <EmptyState title="Nobody to show for this filter." />;
          return (
            <View className="gap-3">
              <Text variant="caption" tone="secondary">
                Due {shortDay(d.dueDate)} · {formatKobo(d.summary.collectedKobo)} of {formatKobo(d.summary.expectedKobo)} collected · times in {d.timezone}
              </Text>
              {d.people.map((p) => (
                <BoardCard key={p.membershipId} testID={`board-person-${p.membershipId}`}>
                  <View className="flex-row items-start justify-between gap-2">
                    <Text variant="body-strong" className="flex-1">
                      {p.isYou ? 'You' : p.name}
                      {p.shares > 1 ? ` × ${p.shares}` : ''}
                    </Text>
                    <AjoMoney kobo={p.amountKobo} />
                  </View>
                  <StatusPill status={p.status} label={p.label} graceEndsOn={p.graceEndsOn} />
                  {p.datePaid || p.confirmedAt ? (
                    <Text variant="caption" tone="secondary">
                      {p.datePaid ? `Paid ${shortDay(p.datePaid)}` : ''}
                      {p.confirmedAt ? ` · confirmed ${formatMomentIn(p.confirmedAt, d.timezone)}` : ''}
                      {p.method ? ` · ${p.method === 'CASH' ? 'cash' : 'transfer'}` : ''}
                      {p.receiptLast4 ? ` · receipt ••${p.receiptLast4}` : ''}
                    </Text>
                  ) : null}
                </BoardCard>
              ))}
            </View>
          );
        }}
      </Gate>
    </View>
  );
}

// ── 4.3 Payment history ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function MatrixView({ groupId }: { groupId: number }) {
  const q = useBoardMatrix(groupId);
  const [picked, setPicked] = useState<{ who: string; round: number; label: string; datePaid: string | null } | null>(null);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        return (
          <View className="gap-3" testID="board-matrix">
            <Text variant="caption" tone="secondary">
              Each square is one round, left to right from round 1. Tap a square for the date it was paid.
            </Text>
            {picked ? (
              <BoardCard>
                <Text variant="body">
                  {picked.who} · round {picked.round} · {picked.label}
                  {picked.datePaid ? `, paid ${shortDay(picked.datePaid)}` : ''}
                </Text>
              </BoardCard>
            ) : null}
            {d.members.map((m) => (
              <BoardCard key={m.membershipId}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="body-strong" className="flex-1">
                    {m.isYou ? 'You' : m.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {m.roundsPaid} of {m.roundsDue} paid
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-1">
                  {m.cells.map((c) => (
                    <StatusSquare key={c.round} status={c.status} label={`Round ${c.round}: ${c.label}`} active={picked?.who === (m.isYou ? 'You' : m.name) && picked.round === c.round} onPress={() => setPicked({ who: m.isYou ? 'You' : m.name, round: c.round, label: c.label, datePaid: c.datePaid })} />
                  ))}
                </View>
              </BoardCard>
            ))}
            <BoardCard title="Paid in each round">
              <Text variant="caption" tone="secondary">
                {d.rounds.map((r) => `R${r.round}: ${r.paidCount}/${r.expectedCount}`).join('   ')}
              </Text>
            </BoardCard>
          </View>
        );
      }}
    </Gate>
  );
}

// ── 4.4 Payouts and 4.5 Members ───────────────────────────────────────────────────────────────────────────────────────────────
export function PayoutsView({ groupId }: { groupId: number }) {
  const q = useBoardPayouts(groupId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        if (d.rows.length === 0) return <EmptyState title="The payout order has not been drawn yet." description="It appears here as soon as the draw is done." />;
        return (
          <View className="gap-3" testID="board-payouts">
            {d.rows.map((r) => (
              <BoardCard key={`${r.position}-${r.shareNo}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <Text variant="body-strong" className="flex-1">
                    {r.position}. {r.isYou ? 'You' : r.recipient}
                  </Text>
                  <AjoMoney kobo={r.potKobo} />
                </View>
                <Text variant="caption" tone="secondary">
                  {r.scheduledOn ? `Scheduled ${shortDay(r.scheduledOn)} · ` : ''}
                  {PAYOUT_LABEL[r.status]}
                  {r.holdReason ? ` · ${r.holdReason}` : ''}
                </Text>
                {r.recordedAt ? (
                  <Text variant="caption" tone="secondary">
                    Recorded {formatMomentIn(r.recordedAt, d.timezone)}
                    {r.referenceLast4 ? ` · ref ••${r.referenceLast4}` : ''}
                    {r.recordedBy ? ` · by ${r.recordedBy}` : ''}
                    {r.approvedBy ? ` · approved by ${r.approvedBy}` : ''}
                  </Text>
                ) : null}
              </BoardCard>
            ))}
            {d.draw ? (
              <BoardCard title="How the order was drawn">
                <Text variant="caption" tone="secondary">
                  Drawn {formatMomentIn(d.draw.drawnAt, d.timezone)}
                  {d.draw.seed ? ` with seed ${d.draw.seed}` : ''}. {d.draw.howToCheck}
                </Text>
              </BoardCard>
            ) : null}
            <BoardCard title="Changes to the order">
              {d.changes.length === 0 ? (
                <Text variant="body" tone="secondary">
                  Nothing has been changed since the draw.
                </Text>
              ) : (
                d.changes.map((c, i) => (
                  <View key={c.id} className="gap-1">
                    {i > 0 ? <Divider /> : null}
                    <Text variant="body">{c.summary}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatMomentIn(c.at, d.timezone)}
                      {c.approvedBy ? ` · approved by ${c.approvedBy}` : ''}
                      {c.reason ? ` · reason: ${c.reason}` : ''}
                    </Text>
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

export function MembersView({ groupId }: { groupId: number }) {
  const q = useBoardMembers(groupId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        return (
          <View className="gap-3" testID="board-members">
            <View className="flex-row gap-3">
              <StatTile label="Members" value={String(d.counts.members)} tone="primary" />
              <StatTile label="Shares" value={String(d.counts.shares)} tone="info" />
              <StatTile label="Verified" value={String(d.counts.verified)} tone="success" />
            </View>
            {d.people.map((p) => (
              <BoardCard key={p.membershipId}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="body-strong" className="flex-1">
                    {p.isYou ? 'You' : p.name}
                  </Text>
                  <Text variant="caption" tone={p.verified ? 'success' : 'tertiary'}>
                    {p.verified ? 'Verified' : 'Not yet verified'}
                  </Text>
                </View>
                <Text variant="caption" tone="secondary">
                  {p.status}
                  {p.joinedOn ? ` · joined ${shortDay(p.joinedOn)}` : ''} · {p.shares} share{p.shares === 1 ? '' : 's'}
                  {p.positions.length > 0 ? ` · position ${p.positions.join(', ')}` : ''}
                </Text>
              </BoardCard>
            ))}
          </View>
        );
      }}
    </Gate>
  );
}

// ── 4.6 Arrears and accountability ────────────────────────────────────────────────────────────────────────────────────────────
export function ArrearsView({ groupId }: { groupId: number }) {
  const q = useBoardArrears(groupId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        const { confirmation: c } = d;
        return (
          <View className="gap-3" testID="board-arrears">
            <BoardCard title="Behind on payments">
              {d.behind.length === 0 ? (
                <Text variant="body" tone="secondary">
                  Nobody is behind past the grace period.
                </Text>
              ) : (
                d.behind.map((r, i) => (
                  <View key={r.membershipId} className="gap-1">
                    {i > 0 ? <Divider /> : null}
                    <View className="flex-row items-start justify-between gap-2">
                      <Text variant="body-strong" className="flex-1">
                        {r.isYou ? 'You' : r.name}
                      </Text>
                      <AjoMoney kobo={r.behindKobo} tone="danger" />
                    </View>
                    <Text variant="caption" tone="secondary">
                      {r.roundsMissed} round{r.roundsMissed === 1 ? '' : 's'} missed · {r.daysOverdue} days overdue · {r.status}
                    </Text>
                  </View>
                ))
              )}
            </BoardCard>

            {d.afterPayout.length > 0 ? (
              <BoardCard title="Behind after receiving the pot">
                <Text variant="caption" tone="secondary">
                  These matter most, because the rest of the circle has already paid them.
                </Text>
                {d.afterPayout.map((r) => (
                  <Text key={r.membershipId} variant="body">
                    {r.isYou ? 'You' : r.name}: {r.text}
                  </Text>
                ))}
              </BoardCard>
            ) : null}

            <BoardCard title="Late fees (circle totals)">
              <FactRow label="Charged">
                <AjoMoney kobo={d.lateFees.chargedKobo} />
              </FactRow>
              <FactRow label="Waived">
                <AjoMoney kobo={d.lateFees.waivedKobo} />
              </FactRow>
              <FactRow label="Paid">
                <AjoMoney kobo={d.lateFees.paidKobo} />
              </FactRow>
              <Text variant="caption" tone="tertiary">
                Each person sees their own late fees on their own page.
              </Text>
            </BoardCard>

            <BoardCard title="How quickly payments are confirmed">
              <Text variant="body">
                {c.waitingCount === 0
                  ? 'No payments are waiting for an officer to confirm them.'
                  : `Payments waiting for confirmation: ${c.waitingCount}${c.oldestDays !== null ? ` (oldest ${c.oldestDays} day${c.oldestDays === 1 ? '' : 's'})` : ''}. ${c.pastTargetCount > 0 ? `${c.pastTargetCount} ${c.pastTargetCount === 1 ? 'has' : 'have'} waited more than ${c.targetHours} hours.` : `The target is ${c.targetHours} hours.`}`}
              </Text>
            </BoardCard>
          </View>
        );
      }}
    </Gate>
  );
}

// ── 4.7 Charts and metrics ────────────────────────────────────────────────────────────────────────────────────────────────────
const MIX: { status: PaymentStatus; label: string; token: 'success' | 'accent' | 'info' | 'textTertiary' | 'warning' | 'danger' | 'primary' }[] = [
  { status: 'PAID_ON_TIME', label: 'Paid on time', token: 'success' },
  { status: 'PAID_LATE', label: 'Paid late', token: 'accent' },
  { status: 'REPORTED', label: 'Reported', token: 'info' },
  { status: 'DUE', label: 'Due', token: 'textTertiary' },
  { status: 'OVERDUE', label: 'Overdue', token: 'warning' },
  { status: 'MISSED', label: 'Missed', token: 'danger' },
  { status: 'UNDER_REVIEW', label: 'Under review', token: 'primary' },
];

const nairaOf = (kobo: string) => Number(BigInt(kobo) / BigInt(100));

export function ChartsView({ groupId }: { groupId: number }) {
  const q = useBoardMetrics(groupId);
  const { color } = useThemeTokens();
  // library-docs.md: every chart has a "view as list" for screen readers and for anyone who would rather read the numbers.
  const [asList, setAsList] = useState(false);
  return (
    <Gate q={q}>
      {() => {
        const m = q.data;
        if (!m) return null;
        if (m.perRound.length === 0) return <EmptyState title="Nothing to chart yet." description="Figures appear once the first round is due." />;
        const bars = m.perRound.flatMap((r) => [
          { value: nairaOf(r.expectedKobo), label: `R${r.round}`, frontColor: color.border, spacing: 2 },
          { value: nairaOf(r.collectedKobo), frontColor: color.primary },
        ]);
        const onTime = m.perRound.map((r) => ({ value: r.onTimeBps === null ? 0 : Math.round(r.onTimeBps / 100), label: `R${r.round}` }));
        const inLine = m.cumulative.map((r) => ({ value: nairaOf(r.contributionsKobo), label: `R${r.round}` }));
        const outLine = m.cumulative.map((r) => ({ value: nairaOf(r.payoutsKobo) }));
        const mix = MIX.map((s) => ({ ...s, value: m.statusMix[s.status] ?? 0 })).filter((s) => s.value > 0);

        return (
          <View className="gap-3" testID="board-charts">
            <View className="flex-row gap-3">
              <StatTile label="Recorded balance" value={formatKobo(m.recordedBalance.kobo)} tone="primary" />
              <StatTile label="Up to date" value={`${m.membersUpToDate.upToDate} of ${m.membersUpToDate.total}`} tone="success" />
            </View>
            <Text variant="caption" tone="tertiary">
              {m.recordedBalance.caption}
            </Text>
            <View className="flex-row gap-3">
              <StatTile label="Total behind" value={formatKobo(m.totalBehindKobo)} tone="warning" />
              <StatTile label="Next payout" value={m.nextPayout ? daysPhrase(m.nextPayout.daysTo) : 'None left'} tone="info" />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="Payouts on the day" value={percent(m.payoutPunctuality.onScheduleBps)} tone="success" />
              <StatTile label="Average days late" value={m.averageDaysLate === null ? 'None late' : String(m.averageDaysLate)} tone="accent" />
            </View>

            <View className="flex-row">
              <FilterChip label={asList ? 'View as charts' : 'View as list'} active={asList} onPress={() => setAsList((v) => !v)} />
            </View>
            {asList ? (
              <BoardCard title="Round by round" testID="board-charts-list">
                {m.perRound.map((r, i) => (
                  <View key={r.round} className="gap-1">
                    {i > 0 ? <Divider /> : null}
                    <Text variant="body-strong">
                      Round {r.round} · due {shortDay(r.dueDate)}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      Collected {formatKobo(r.collectedKobo)} of {formatKobo(r.expectedKobo)} · paid on time {percent(r.onTimeBps)}
                      {m.cumulative[i] ? ` · money in ${formatKobo(m.cumulative[i]?.contributionsKobo)}, out ${formatKobo(m.cumulative[i]?.payoutsKobo)}` : ''}
                    </Text>
                  </View>
                ))}
                <Text variant="caption" tone="secondary">
                  This round: {mix.length === 0 ? 'no payments yet' : mix.map((s) => `${s.label} ${s.value}`).join(', ')}
                </Text>
              </BoardCard>
            ) : (
              <>
            <BoardCard title="Collected against expected">
              <Text variant="caption" tone="secondary">
                Pale bar: expected. Dark bar: collected. Left to right by round.
              </Text>
              <BarChart data={bars} barWidth={14} spacing={14} hideRules noOfSections={4} xAxisColor={color.border} yAxisColor={color.border} xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }} yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }} yAxisLabelWidth={84} formatYLabel={(v) => formatKobo(BigInt(Math.round(Number(v))) * BigInt(100)).replace('.00', '')} height={140} backgroundColor={color.surface} />
            </BoardCard>

            <BoardCard title="Paid on time, each round">
              <LineChart data={onTime} color={color.primary} thickness={2} hideRules maxValue={100} noOfSections={4} xAxisColor={color.border} yAxisColor={color.border} xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }} yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }} formatYLabel={(v) => `${v}%`} height={120} backgroundColor={color.surface} />
            </BoardCard>

            <BoardCard title="Money in and money out">
              <Text variant="caption" tone="secondary">
                Dark line: contributions confirmed. Blue line: payouts recorded.
              </Text>
              <LineChart data={inLine} data2={outLine} color1={color.primary} color2={color.info} thickness={2} hideRules noOfSections={4} xAxisColor={color.border} yAxisColor={color.border} xAxisLabelTextStyle={{ color: color.textSecondary, fontSize: 10 }} yAxisTextStyle={{ color: color.textSecondary, fontSize: 9 }} yAxisLabelWidth={84} formatYLabel={(v) => formatKobo(BigInt(Math.round(Number(v))) * BigInt(100)).replace('.00', '')} height={140} backgroundColor={color.surface} />
            </BoardCard>

            <BoardCard title="This round">
              {mix.length === 0 ? (
                <Text variant="body" tone="secondary">
                  No payments to show for this round.
                </Text>
              ) : (
                <View className="flex-row items-center gap-4">
                  <PieChart data={mix.map((s) => ({ value: s.value, color: color[s.token] }))} donut radius={56} innerRadius={34} innerCircleColor={color.surface} />
                  <View className="flex-1 gap-1">
                    {mix.map((s) => (
                      <Text key={s.status} variant="caption">
                        {s.label}: {s.value}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </BoardCard>
              </>
            )}
          </View>
        );
      }}
    </Gate>
  );
}

// ── 4.8 Circle activity ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function ActivityView({ groupId }: { groupId: number }) {
  const q = useBoardActivity(groupId);
  return (
    <Gate q={q}>
      {() => {
        const d = q.data;
        if (!d) return null;
        if (d.entries.length === 0) return <EmptyState title="Nothing has happened yet." description="Confirmed payments, payouts and rule changes appear here." />;
        return (
          <View className="gap-2" testID="board-activity">
            <Text variant="caption" tone="secondary">
              Everyone in the circle sees the same log. Times are in {d.timezone}.
            </Text>
            {d.entries.map((e, i) => (
              <BoardCard key={`${e.at}-${i}`}>
                <Text variant="body">{e.text}</Text>
                <Text variant="caption" tone="tertiary">
                  {formatMomentIn(e.at, d.timezone)}
                </Text>
              </BoardCard>
            ))}
          </View>
        );
      }}
    </Gate>
  );
}
