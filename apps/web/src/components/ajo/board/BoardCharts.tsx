'use client';

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { formatDay, formatKobo } from '@/lib/ajo/format';
import { useBoardMetrics } from '@/lib/ajo/boardHooks';
import type { PaymentStatus } from '@/lib/ajo/boardTypes';
import { Card, percent, Stat } from './BoardParts';

// Theme colours, not hex values. A chart is never the only place a figure appears: every one below also reads out in words or in the table views.
const INK = 'var(--mantine-color-green-7)';
const SOFT = 'var(--mantine-color-gray-5)';
const BLUE = 'var(--mantine-color-blue-6)';

const MIX: Array<{ status: PaymentStatus; label: string; color: string }> = [
  { status: 'PAID_ON_TIME', label: 'Paid on time', color: 'var(--mantine-color-green-6)' },
  { status: 'PAID_LATE', label: 'Paid late', color: 'var(--mantine-color-lime-6)' },
  { status: 'REPORTED', label: 'Reported', color: 'var(--mantine-color-blue-6)' },
  { status: 'DUE', label: 'Due', color: 'var(--mantine-color-gray-5)' },
  { status: 'OVERDUE', label: 'Overdue', color: 'var(--mantine-color-yellow-6)' },
  { status: 'MISSED', label: 'Missed', color: 'var(--mantine-color-red-6)' },
  { status: 'UNDER_REVIEW', label: 'Under review', color: 'var(--mantine-color-grape-6)' },
];

/** Kobo string to naira for an axis. Chart axes show the full figure too, never a shortened one. */
const naira = (kobo: string) => Number(BigInt(kobo) / BigInt(100));

/** 4.7 Charts and metrics. */
export function BoardChartsView({ groupId }: { groupId: number }) {
  const q = useBoardMetrics(groupId);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data;
  if (m.perRound.length === 0) return <AjoEmpty title="Nothing to chart yet." hint="Figures appear once the first round is due." />;

  const perRound = m.perRound.map((r) => ({ name: `R${r.round}`, Expected: naira(r.expectedKobo), Collected: naira(r.collectedKobo), onTime: r.onTimeBps === null ? null : Math.round(r.onTimeBps / 100) }));
  const cumulative = m.cumulative.map((r) => ({ name: `R${r.round}`, 'Money in': naira(r.contributionsKobo), 'Money out': naira(r.payoutsKobo) }));
  const mix = MIX.map((s) => ({ ...s, value: m.statusMix[s.status] ?? 0 })).filter((s) => s.value > 0);
  const money = (v: number) => formatKobo(BigInt(Math.round(v)) * BigInt(100));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recorded balance" hint={m.recordedBalance.caption}>
          <Money kobo={m.recordedBalance.kobo} />
        </Stat>
        <Stat label="Members fully up to date">
          {m.membersUpToDate.upToDate} of {m.membersUpToDate.total}
        </Stat>
        <Stat label="Total behind">
          <Money kobo={m.totalBehindKobo} />
        </Stat>
        <Stat label="Next payout" hint={m.nextPayout ? `Position ${m.nextPayout.position}, ${formatDay(m.nextPayout.scheduledOn)}` : undefined}>
          {m.nextPayout ? (m.nextPayout.daysTo > 0 ? `in ${m.nextPayout.daysTo} days` : m.nextPayout.daysTo === 0 ? 'today' : `${-m.nextPayout.daysTo} days ago`) : 'None left'}
        </Stat>
        <Stat label="Payouts on the scheduled day" hint={`${m.payoutPunctuality.onScheduleCount} of ${m.payoutPunctuality.paidCount}`}>
          {percent(m.payoutPunctuality.onScheduleBps)}
        </Stat>
        <Stat label="Average days late">{m.averageDaysLate === null ? 'None late' : m.averageDaysLate}</Stat>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Collected against expected, each round">
          <div className="h-64" role="img" aria-label="Bar chart of the amount collected and the amount expected in each round">
            <ResponsiveContainer>
              <BarChart data={perRound}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v: number) => money(v)} width={110} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar dataKey="Expected" fill={SOFT} />
                <Bar dataKey="Collected" fill={INK} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Paid on time, each round">
          <div className="h-64" role="img" aria-label="Line chart of the share of members paid on time in each round">
            <ResponsiveContainer>
              <LineChart data={perRound}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="onTime" name="On time" stroke={INK} connectNulls dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Money in and money out">
          <div className="h-64" role="img" aria-label="Line chart of confirmed contributions and recorded payouts added up over the rounds">
            <ResponsiveContainer>
              <LineChart data={cumulative}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v: number) => money(v)} width={110} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Line type="monotone" dataKey="Money in" stroke={INK} dot />
                <Line type="monotone" dataKey="Money out" stroke={BLUE} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="This round">
          {mix.length === 0 ? (
            <p className="text-sm text-ink-muted">No payments to show for this round.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-48 w-48" role="img" aria-label="Donut chart of this round's payment statuses">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={mix} dataKey="value" nameKey="label" innerRadius={45} outerRadius={80}>
                      {mix.map((s) => (
                        <Cell key={s.status} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm text-ink">
                {mix.map((s) => (
                  <li key={s.status}>
                    {s.label}: {s.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
