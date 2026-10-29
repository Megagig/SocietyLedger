'use client';

import { SegmentedControl, Select } from '@mantine/core';
import { useState } from 'react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { formatDay } from '@/lib/ajo/format';
import { useBoardMatrix, useBoardOverview, useBoardRound } from '@/lib/ajo/boardHooks';
import { formatMomentIn, StatusChip, StatusGlyph } from './BoardParts';

/** 4.2 This round, or any earlier round. */
export function BoardRoundView({ groupId }: { groupId: number }) {
  const overview = useBoardOverview(groupId);
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'NOT_PAID'>('ALL');
  const round = picked ?? overview.data?.header.round ?? 1;
  const q = useBoardRound(groupId, round, filter);
  const total = overview.data?.header.totalRounds ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          label="Round"
          w={200}
          allowDeselect={false}
          data={Array.from({ length: total }, (_, i) => ({ value: String(i + 1), label: `Round ${i + 1}${overview.data && i + 1 === overview.data.header.round ? ' (now)' : ''}` }))}
          value={String(round)}
          onChange={(v) => setPicked(v ? Number(v) : null)}
        />
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          data={[
            { value: 'ALL', label: 'All' },
            { value: 'PAID', label: 'Paid' },
            { value: 'NOT_PAID', label: 'Not yet paid' },
          ]}
        />
      </div>

      {q.isLoading ? (
        <AjoLoading rows={5} />
      ) : q.isError || !q.data ? (
        <AjoError error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.people.length === 0 ? (
        <AjoEmpty title="Nobody to show for this filter." />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Due {formatDay(q.data.dueDate)} · <Money kobo={q.data.summary.collectedKobo} /> of <Money kobo={q.data.summary.expectedKobo} /> collected · times in {q.data.timezone}
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Member</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Paid on</th>
                  <th className="px-4 py-2 font-medium">Confirmed</th>
                  <th className="px-4 py-2 font-medium">How</th>
                  <th className="px-4 py-2 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {q.data.people.map((p) => (
                  <tr key={p.membershipId} className={`border-t border-line-soft ${p.isYou ? 'bg-surface-muted' : ''}`}>
                    <td className="px-4 py-2">
                      {p.isYou ? 'You' : p.name}
                      {p.shares > 1 ? <span className="text-ink-faint"> × {p.shares}</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      <StatusChip status={p.status} label={p.label} graceEndsOn={p.graceEndsOn} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Money kobo={p.amountKobo} />
                    </td>
                    <td className="px-4 py-2">{p.datePaid ? formatDay(p.datePaid) : ''}</td>
                    <td className="px-4 py-2">{formatMomentIn(p.confirmedAt, q.data.timezone)}</td>
                    <td className="px-4 py-2">{p.method === 'CASH' ? 'Cash' : p.method === 'TRANSFER' ? 'Transfer' : ''}</td>
                    <td className="px-4 py-2 tabular-nums">{p.receiptLast4 ? `••${p.receiptLast4}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** 4.3 Payment history: members down, rounds across. The whole circle on one screen. */
export function BoardMatrixView({ groupId }: { groupId: number }) {
  const q = useBoardMatrix(groupId);
  if (q.isLoading) return <AjoLoading rows={5} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { rounds, members } = q.data;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Each square is one payment. Hover or tap it for the date it was paid.</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-ink-muted">
            <tr>
              <th className="sticky left-0 bg-surface-muted px-3 py-2 text-left font-medium">Member</th>
              {rounds.map((r) => (
                <th key={r.round} className="px-2 py-2 text-center font-medium" title={`Due ${formatDay(r.dueDate)}`}>
                  {r.round}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Paid / due</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId} className={`border-t border-line-soft ${m.isYou ? 'bg-surface-muted' : ''}`}>
                <td className="sticky left-0 bg-inherit px-3 py-2">{m.isYou ? 'You' : m.name}</td>
                {rounds.map((r) => {
                  const cell = m.cells.find((c) => c.round === r.round);
                  return (
                    <td key={r.round} className="px-2 py-1 text-center">
                      {cell ? <StatusGlyph status={cell.status} label={cell.label} title={cell.datePaid ? `${cell.label}, ${formatDay(cell.datePaid)}` : cell.label} /> : null}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.roundsPaid} / {m.roundsDue}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-surface-muted text-xs text-ink-muted">
            <tr>
              <td className="px-3 py-2 font-medium">Paid</td>
              {rounds.map((r) => (
                <td key={r.round} className="px-2 py-2 text-center tabular-nums" title={`${r.paidCount} of ${r.expectedCount} paid`}>
                  {r.paidCount}/{r.expectedCount}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
