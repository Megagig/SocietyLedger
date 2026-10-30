'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Select, TextInput } from '@mantine/core';
import { IconArrowLeft, IconDownload, IconLock } from '@tabler/icons-react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { ReportFigures, ReportPager, ReportTable } from '@/components/ajo/reports/ReportParts';
import { downloadReport, REPORT_PAGE_SIZE, useReport, useReportList } from '@/lib/ajo/reportHooks';
import type { ReportFilters, ReportName } from '@/lib/ajo/reportTypes';
import { useCollectorCandidates, useGroups, usePeople } from '@/lib/ajo/staffHooks';
import { formatMoment } from '@/lib/ajo/format';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { toast } from '@/lib/toast';

const asNumber = (v: string | null) => (v ? Number(v) : null);

/**
 * One report: filters for the circle and dates (and the person or collector where the report understands them), the figures for each
 * circle, the rows a page at a time, and the CSV and PDF downloads. The rule the report counts by is printed under its title.
 */
export default function AjoReportPage() {
  const params = useParams<{ name: string }>();
  const name = params.name as ReportName;
  const list = useReportList();
  const def = list.data?.find((r) => r.name === name);

  const [filters, setFilters] = useState<ReportFilters>({});
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const change = (patch: ReportFilters) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const report = useReport(name, filters, page, !!def && !def.lock);
  const groups = useGroups();
  const people = usePeople(def?.filters.member ? filters.groupId ?? 0 : 0);
  const collectors = useCollectorCandidates();

  const download = async (format: 'csv' | 'pdf') => {
    setBusy(format);
    try {
      await downloadReport(name, filters, format);
    } catch (e) {
      toast.error(ajoErrorMessage(e, 'Could not make the file. Try again, or narrow the dates.'));
    } finally {
      setBusy(null);
    }
  };

  if (list.isLoading) return <AjoLoading rows={3} />;
  if (list.isError || !list.data) return <AjoError error={list.error} onRetry={() => list.refetch()} />;
  if (!def) return <AjoEmpty title="There is no such report." action={<Button component={Link} href="/dashboard/ajo/reports" variant="default" size="xs">All reports</Button>} />;

  const back = (
    <Link href="/dashboard/ajo/reports" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
      <IconArrowLeft size={14} aria-hidden /> All reports
    </Link>
  );

  if (def.lock) {
    return (
      <div className="space-y-4">
        {back}
        <div role="status" className="mx-auto max-w-md rounded-lg border border-line p-8 text-center">
          <IconLock size={32} className="mx-auto mb-3 text-ink-subtle" aria-hidden />
          <p className="text-lg font-semibold text-ink">{def.title}</p>
          <p className="mt-2 text-sm text-ink-muted">{def.lock.message}</p>
        </div>
      </div>
    );
  }

  const data = report.data;
  const circleOptions = (groups.data ?? []).map((g) => ({ value: String(g.id), label: g.name }));
  const personOptions = (people.data ?? []).map((p) => ({ value: String(p.membershipId), label: p.name }));
  const collectorOptions = (collectors.data ?? []).map((c) => ({ value: String(c.userId), label: c.name }));

  return (
    <div className="space-y-5">
      {back}
      <div>
        <h1 className="text-3xl font-bold text-ink">{def.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted"><strong className="font-medium text-ink">How this is counted.</strong> {def.rule}</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Report filters">
        <Select
          label="Circle"
          placeholder="All circles"
          data={circleOptions}
          value={filters.groupId ? String(filters.groupId) : null}
          onChange={(v) => change({ groupId: asNumber(v), membershipId: null })}
          clearable
          w={220}
        />
        <TextInput label="From" type="date" value={filters.from ?? ''} onChange={(e) => change({ from: e.currentTarget.value || undefined })} w={160} />
        <TextInput label="To" type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => change({ to: e.currentTarget.value || undefined })} w={160} />
        {def.filters.member && filters.groupId ? (
          <Select label="Person" placeholder="Everyone" data={personOptions} value={filters.membershipId ? String(filters.membershipId) : null} onChange={(v) => change({ membershipId: asNumber(v) })} clearable searchable w={220} />
        ) : null}
        {def.filters.collector && collectorOptions.length > 0 ? (
          <Select label="Collector" placeholder="All collectors" data={collectorOptions} value={filters.collectorUserId ? String(filters.collectorUserId) : null} onChange={(v) => change({ collectorUserId: asNumber(v) })} clearable searchable w={220} />
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button variant="default" size="sm" leftSection={<IconDownload size={14} aria-hidden />} loading={busy === 'csv'} disabled={!data || busy !== null} onClick={() => download('csv')}>CSV</Button>
          <Button variant="default" size="sm" leftSection={<IconDownload size={14} aria-hidden />} loading={busy === 'pdf'} disabled={!data || busy !== null} onClick={() => download('pdf')}>PDF</Button>
        </div>
      </form>
      {!filters.from && !filters.to ? <p className="-mt-2 text-xs text-ink-muted">No dates chosen, so this shows the running month. Pick up to 12 months.</p> : null}

      {report.isLoading ? (
        <AjoLoading rows={4} />
      ) : report.isError || !data ? (
        <AjoError error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <div className="space-y-5" aria-busy={report.isFetching}>
          <p className="text-sm text-ink-muted">
            {data.filters.from} to {data.filters.to} · made {formatMoment(data.generatedAt)}
          </p>
          {data.notes.map((n) => <p key={n} className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-ink">{n}</p>)}
          <ReportFigures blocks={data.blocks} totals={data.totals} />
          {data.blocks.length === 0 ? (
            <AjoEmpty title="No circles to report on yet." hint="A circle appears here once it has been opened." />
          ) : data.page.total === 0 ? (
            <AjoEmpty title="Nothing to show for these dates." hint="Try a wider range, or another circle." />
          ) : (
            <section className="space-y-3" aria-label="Details">
              <h2 className="text-base font-semibold text-ink">Details</h2>
              <ReportTable columns={data.columns} rows={data.rows} />
              <ReportPager page={data.page.page} pageSize={data.page.pageSize || REPORT_PAGE_SIZE} total={data.page.total} onPage={setPage} busy={report.isFetching} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
