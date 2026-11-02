'use client';

import { useMemo, useState } from 'react';
import { Button } from '@mantine/core';
import { IconArrowsSort, IconRefresh } from '@tabler/icons-react';
import { useMyPendingPayments } from '@/lib/coop/hooks';
import { coopApi } from '@/lib/coop/api';
import { getLoanRepaymentReceiptUrl } from '@/lib/api/cooperatives';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { RangeBar } from '@/components/coop/RangeBar';
import { ReceiptButton } from '@/components/coop/ReceiptButton';
import { StatusPill } from '@/components/coop/StatusPill';
import { formatDate } from '@/utils/format';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 2);
  return { from: isoDay(from), to: isoDay(to) };
};

const selectClass =
  'h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';
const th = 'px-4 py-2 font-medium';

/**
 * My Pending Payments: every payment you have declared (savings payments and loan repayments) and where each one stands. A payment is only
 * added to your account once an officer confirms the money arrived; a rejected one says why, so you know what to fix.
 */
export default function MyPendingPaymentsPage() {
  const [range, setRange] = useState(defaultRange);
  const [type, setType] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const data = useMyPendingPayments({ ...range, type: type || undefined, sort: newestFirst ? 'newest' : 'oldest' });
  const items = useMemo(() => data.data?.items ?? [], [data.data]);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const visible = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHead
        title="My pending payments"
        subtitle="Review the payments you have declared and where each one stands."
        actions={
          <Button variant="default" leftSection={<IconRefresh size={16} />} loading={data.isFetching && !data.isLoading} onClick={() => data.refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[20rem] flex-1">
          <RangeBar
            from={range.from}
            to={range.to}
            onApply={(next) => {
              setRange(next);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="payment-type">Payment type</label>
          <select id="payment-type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={selectClass}>
            <option value="">All types</option>
            <option value="SAVINGS">Savings payments</option>
            <option value="LOAN_REPAYMENT">Loan repayments</option>
          </select>
          <Button variant="default" leftSection={<IconArrowsSort size={16} />} onClick={() => setNewestFirst((v) => !v)} className="h-11">
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {data.data ? `${data.data.count} record${data.data.count === 1 ? '' : 's'}` : ''}
      </p>

      {data.isLoading ? (
        <CoopLoading />
      ) : data.isError ? (
        <CoopError error={data.error} onRetry={() => data.refetch()} />
      ) : items.length === 0 ? (
        <CoopEmpty title="No pending payments found" hint="Payments you declare will be listed here until an officer confirms them." />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-lg border border-line">
            <table aria-label="My payments" className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted">
                <tr>
                  <th scope="col" className={th}>Date</th>
                  <th scope="col" className={th}>Payment type</th>
                  <th scope="col" className={`${th} text-right`}>Amount (₦)</th>
                  <th scope="col" className={th}>Reference</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} className="border-t border-line-soft align-top">
                    <td className="px-4 py-2">{formatDate(item.date)}</td>
                    <td className="px-4 py-2">
                      {item.paymentType}
                      {item.detail && item.detail !== item.paymentType && <span className="block text-xs text-ink-muted">{item.detail}</span>}
                    </td>
                    <td className="px-4 py-2 text-right"><Naira value={item.amount} /></td>
                    <td className="px-4 py-2">{item.reference || '—'}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={item.status} />
                      {item.status === 'REJECTED' && item.rejectionReason && <span className="mt-1 block text-xs text-danger-text">{item.rejectionReason}</span>}
                    </td>
                    <td className="px-4 py-2">
                      {item.hasReceipt && (
                        <ReceiptButton getUrl={() => (item.kind === 'SAVINGS' ? coopApi.paymentReceiptUrl(item.id) : getLoanRepaymentReceiptUrl(item.id))} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-3 text-sm">
            <label className="flex items-center gap-2 text-ink-muted">
              Rows per page
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={selectClass}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="text-ink-muted">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="default" size="xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="default" size="xs" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
