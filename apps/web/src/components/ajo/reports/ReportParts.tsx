'use client';

import { Button } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatDay, formatKobo, formatMoment, MODEL_LABEL } from '@/lib/ajo/format';
import type { ReportCell, ReportCircle, ReportColumn, ReportMetric, ReportRow, ReportTotals } from '@/lib/ajo/reportTypes';

/** A figure as the person reads it. Money is always in full (₦10,000.00). A figure that does not apply shows a dash, never a zero. */
export function formatMetric(m: ReportMetric): string {
  if (m.value === null || m.value === undefined) return '—';
  if (m.kind === 'money') return formatKobo(m.value as string);
  if (m.kind === 'percent') return `${((m.value as number) / 100).toFixed(1)}%`;
  return Number(m.value).toLocaleString('en-NG');
}

export function formatCell(column: ReportColumn, value: ReportCell): string {
  if (value === null || value === undefined || value === '') return '';
  switch (column.kind) {
    case 'money': return formatKobo(value as string);
    case 'date': return formatDay(String(value));
    case 'datetime': return formatMoment(String(value));
    case 'int': return Number(value).toLocaleString('en-NG');
    case 'percent': return `${(Number(value) / 100).toFixed(1)}%`;
    default: return String(value);
  }
}

const numeric = (c: ReportColumn) => c.kind === 'money' || c.kind === 'int' || c.kind === 'percent';

function FigureGrid({ metrics }: { metrics: ReportMetric[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-lg border border-line p-3">
          <dt className="text-xs text-ink-faint">{m.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatMetric(m)}</dd>
          {m.hint ? <p className="mt-1 text-xs text-ink-muted">{m.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

/** One block per circle with its figures, then a total for circles of the same kind. A rotating pot and a collector-thrift group are never added together. */
export function ReportFigures({ blocks, totals }: { blocks: ReportCircle[]; totals: ReportTotals[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-5">
      {blocks.map((b) => (
        <section key={b.groupId} className="space-y-2" aria-label={`Figures for ${b.groupName}`}>
          <h2 className="text-base font-semibold text-ink">
            {b.groupName} <span className="text-sm font-normal text-ink-muted">· {MODEL_LABEL[b.model]}</span>
          </h2>
          <FigureGrid metrics={b.metrics} />
        </section>
      ))}
      {totals.map((t) => (
        <section key={t.label} className="space-y-2" aria-label={t.label}>
          <h2 className="text-base font-semibold text-ink">
            {t.label} <span className="text-sm font-normal text-ink-muted">· {t.circles} circles added together</span>
          </h2>
          <FigureGrid metrics={t.metrics} />
        </section>
      ))}
    </div>
  );
}

export function ReportTable({ columns, rows }: { columns: ReportColumn[]; rows: ReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${numeric(c) ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line-soft align-top">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${numeric(c) ? 'whitespace-nowrap text-right tabular-nums' : ''} ${c.key === 'what' || c.key === 'note' || c.key === 'reason' ? 'min-w-[16rem]' : ''}`}>
                  {formatCell(c, r[c.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportPager({ page, pageSize, total, onPage, busy }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; busy?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Report pages">
      <p className="text-ink-muted" aria-live="polite">{total === 0 ? 'No rows' : `Rows ${from.toLocaleString('en-NG')} to ${to.toLocaleString('en-NG')} of ${total.toLocaleString('en-NG')}`}</p>
      <div className="flex items-center gap-2">
        <Button variant="default" size="xs" leftSection={<IconChevronLeft size={14} aria-hidden />} disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="text-ink-muted">Page {page} of {pages}</span>
        <Button variant="default" size="xs" rightSection={<IconChevronRight size={14} aria-hidden />} disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
