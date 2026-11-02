'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { CoopButton } from '@/components/coop/CoopButton';
import { IconDownload, IconRefresh } from '@tabler/icons-react';
import { useCoopTransactions } from '@/lib/coop/hooks';
import { downloadXlsx } from '@/lib/coop/exportXlsx';
import { CoopEmpty, CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { RangeBar } from '@/components/coop/RangeBar';
import { StatTile } from '@/components/coop/StatTile';
import { StatusTabs } from '@/components/coop/StatusTabs';
import { toast } from '@/lib/toast';
import { formatDate } from '@/utils/format';
import type { CoopTransactions } from '@/lib/coop/types';

type Tab = 'overview' | 'loans' | 'contributions' | 'shares';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'loans', label: 'Loans' },
  { value: 'contributions', label: 'Contributions' },
  { value: 'shares', label: 'Shares' },
];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  return { from: isoDay(from), to: isoDay(to) };
};

const th = 'px-4 py-2 font-medium';

function Table({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line">
      <table aria-label={label} className="w-full min-w-[34rem] text-sm">
        {children}
      </table>
    </div>
  );
}

/**
 * My Transactions: your own contributions, shares and loans. The Overview adds up everything since you joined; the other tabs follow the
 * dates you choose. Every figure comes from the same records the officers use, so it can't disagree with the books.
 */
export default function MyTransactionsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState(defaultRange);
  const data = useCoopTransactions(range);

  const exportExcel = async () => {
    if (!data.data) return;
    try {
      const d = data.data;
      if (tab === 'loans') {
        await downloadXlsx('my-loan-transactions', 'Loans', [{ header: 'Date' }, { header: 'Loan category' }, { header: 'Loan title' }, { header: 'Amount', money: true }, { header: 'Repaid', money: true }, { header: 'Balance', money: true }],
          d.loans.rows.map((r) => [formatDate(r.date), r.category, r.title, r.amount, r.repaid, r.balance]));
      } else if (tab === 'contributions' || tab === 'shares') {
        const part = tab === 'contributions' ? d.contributions : d.shares;
        await downloadXlsx(`my-${tab}`, tab === 'contributions' ? 'Contributions' : 'Shares', [{ header: 'Date' }, { header: 'Type' }, { header: 'Member' }, { header: 'Amount', money: true }],
          part.rows.map((r) => [formatDate(r.date), r.typeName, r.memberName, r.amount]));
      } else {
        await downloadXlsx('my-transactions-overview', 'Overview', [{ header: 'Category', width: 24 }, { header: 'Metric', width: 28 }, { header: 'Amount', money: true }], [
          ['Loans', 'Total loans disbursed', d.overview.loansDisbursed],
          ['Loans', 'Total loan repayments', d.overview.loanRepayments],
          ['Loans', 'Outstanding loan balance', d.overview.outstandingLoans],
          ['Contributions', 'Total contributions', d.overview.contributions],
          ['Shares', 'Total shares', d.overview.shares],
        ]);
      }
    } catch {
      toast.error('We could not create the Excel file.');
    }
  };

  const d: CoopTransactions | undefined = data.data;

  return (
    <div className="space-y-6">
      <PageHead
        title="Transaction history"
        subtitle="Review your personal contribution, loan, and share activities."
        actions={
          <>
            <Button variant="default" leftSection={<IconRefresh size={16} />} loading={data.isFetching && !data.isLoading} onClick={() => data.refetch()}>
              Refresh
            </Button>
            <CoopButton tone="primary" leftSection={<IconDownload size={16} />} onClick={exportExcel} disabled={!d}>
              Excel
            </CoopButton>
          </>
        }
      />

      {tab !== 'overview' && <RangeBar from={range.from} to={range.to} onApply={setRange} />}

      <StatusTabs label="Transaction views" tabs={TABS} value={tab} onChange={setTab} panelId={`panel-${tab}`} columns="grid-cols-2 sm:grid-cols-4" />

      {data.isLoading ? (
        <CoopLoading rows={3} height={96} />
      ) : data.isError || !d ? (
        <CoopError error={data.error} onRetry={() => data.refetch()} />
      ) : (
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
          {tab === 'overview' && (
            <>
              <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                <span className="font-medium text-ink">All-time cumulative overview</span> — summarizes your complete cooperative financial record.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Contributions" value={d.overview.contributions} tone="success" />
                <StatTile label="Shares" value={d.overview.shares} tone="info" />
                <StatTile label="Loans disbursed" value={d.overview.loansDisbursed} tone="neutral" />
                <StatTile label="Outstanding loans" value={d.overview.outstandingLoans} tone={Number(d.overview.outstandingLoans) > 0 ? 'danger' : 'warning'} />
              </div>
              <Table label="Overview breakdown">
                <thead className="bg-surface-muted text-left text-ink-muted">
                  <tr>
                    <th scope="col" className={th}>Category</th>
                    <th scope="col" className={th}>Breakdown metric</th>
                    <th scope="col" className={`${th} text-right`}>Amount (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Loans', 'Total loans disbursed', d.overview.loansDisbursed],
                    ['', 'Total loan repayments', d.overview.loanRepayments],
                    ['', 'Outstanding loan balance', d.overview.outstandingLoans],
                    ['Contributions', 'Total contributions', d.overview.contributions],
                    ['Shares', 'Total shares', d.overview.shares],
                  ].map(([category, metric, amount]) => (
                    <tr key={metric} className="border-t border-line-soft">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-info-text">{category}</th>
                      <td className="px-4 py-2">{metric}</td>
                      <td className="px-4 py-2 text-right"><Naira value={amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}

          {tab === 'loans' && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile label="Total loans" value={d.loans.totalLoans} tone="info" />
                <StatTile label="Total repaid" value={d.loans.totalRepaid} tone="success" />
                <StatTile label="Outstanding balance" value={d.loans.outstandingBalance} tone="warning" />
              </div>
              {d.loans.rows.length === 0 ? (
                <CoopEmpty title="No loan records found for this period." />
              ) : (
                <Table label="Loans in this period">
                  <thead className="bg-surface-muted text-left text-ink-muted">
                    <tr>
                      <th scope="col" className={th}>Date</th>
                      <th scope="col" className={th}>Loan category</th>
                      <th scope="col" className={th}>Loan title</th>
                      <th scope="col" className={`${th} text-right`}>Amount (₦)</th>
                      <th scope="col" className={`${th} text-right`}>Repaid (₦)</th>
                      <th scope="col" className={`${th} text-right`}>Balance (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.loans.rows.map((r) => (
                      <tr key={r.id} className="border-t border-line-soft">
                        <td className="px-4 py-2">{formatDate(r.date)}</td>
                        <td className="px-4 py-2">{r.category}</td>
                        <td className="px-4 py-2">{r.title}</td>
                        <td className="px-4 py-2 text-right"><Naira value={r.amount} /></td>
                        <td className="px-4 py-2 text-right"><Naira value={r.repaid} /></td>
                        <td className="px-4 py-2 text-right"><Naira value={r.balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {(tab === 'contributions' || tab === 'shares') && (
            <>
              <StatTile label={tab === 'contributions' ? 'Total contributions' : 'Total shares'} value={(tab === 'contributions' ? d.contributions : d.shares).total} tone={tab === 'contributions' ? 'success' : 'info'} />
              {(tab === 'contributions' ? d.contributions : d.shares).rows.length === 0 ? (
                <CoopEmpty title={tab === 'contributions' ? 'No contributions found for this period.' : 'No share purchases found for this period.'} />
              ) : (
                <Table label={tab === 'contributions' ? 'Contributions in this period' : 'Share purchases in this period'}>
                  <thead className="bg-surface-muted text-left text-ink-muted">
                    <tr>
                      <th scope="col" className={th}>Date</th>
                      <th scope="col" className={th}>{tab === 'contributions' ? 'Contribution type' : 'Share type'}</th>
                      <th scope="col" className={th}>Member name</th>
                      <th scope="col" className={`${th} text-right`}>Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === 'contributions' ? d.contributions : d.shares).rows.map((r) => (
                      <tr key={r.id} className="border-t border-line-soft">
                        <td className="px-4 py-2">{formatDate(r.date)}</td>
                        <td className="px-4 py-2">{r.typeName}</td>
                        <td className="px-4 py-2">{r.memberName}</td>
                        <td className="px-4 py-2 text-right"><Naira value={r.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          <p className="text-xs text-ink-muted">
            {tab === 'overview' ? 'Period: all-time cumulative.' : `Period: ${formatDate(range.from)} – ${formatDate(range.to)}.`}
          </p>
        </div>
      )}
    </div>
  );
}
