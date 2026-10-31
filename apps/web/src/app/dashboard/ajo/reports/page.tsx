'use client';

import Link from 'next/link';
import { Badge } from '@mantine/core';
import { IconChevronRight, IconLock } from '@tabler/icons-react';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { useReportList } from '@/lib/ajo/reportHooks';
import type { ReportListItem } from '@/lib/ajo/reportTypes';

function Entry({ r }: { r: ReportListItem }) {
  const body = (
    <div className={`flex h-full items-start justify-between gap-3 rounded-lg border p-4 ${r.lock ? 'border-line bg-surface-muted' : 'border-line hover:border-line-strong'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{r.title}</h2>
          <Badge variant="light" color={r.tier === 'BASIC' ? 'gray' : r.tier === 'ADVANCED' ? 'blue' : 'violet'} size="sm">{r.tierLabel}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{r.description}</p>
        {r.lock ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-warning-strong">
            <IconLock size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{r.lock.message}</span>
          </p>
        ) : null}
      </div>
      {r.lock ? null : <IconChevronRight size={18} className="mt-1 shrink-0 text-ink-subtle" aria-hidden />}
    </div>
  );
  // A locked report is still shown, with why, but it is not a link.
  return r.lock ? <div aria-disabled="true">{body}</div> : <Link href={`/dashboard/ajo/reports/${r.name}`} className="block no-underline hover:no-underline rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{body}</Link>;
}

/** The reports hub: the eight Ajo reports, with the ones this person or this Ajo tier cannot open shown and explained. */
export default function AjoReportsPage() {
  const list = useReportList();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Thrift reports</h1>
        <p className="mt-1 text-ink-muted">Every figure is worked out from the circle's ledger and the schedule, the same way on every screen and in every file. Open a report to choose the circle and dates, and to download it.</p>
      </div>
      {list.isLoading ? (
        <AjoLoading rows={4} />
      ) : list.isError || !list.data ? (
        <AjoError error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.map((r) => <Entry key={r.name} r={r} />)}
        </div>
      )}
    </div>
  );
}
