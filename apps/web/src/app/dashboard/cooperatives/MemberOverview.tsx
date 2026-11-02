'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconBuildingBank, IconCoin, IconEye, IconEyeOff, IconPigMoney, IconRefresh, IconTrendingUp, IconWallet } from '@tabler/icons-react';
import { useCoopDashboard, useMyPendingPayments } from '@/lib/coop/hooks';
import { CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { ContributionTable } from '@/components/coop/ContributionTable';
import { MonthlyBars } from '@/components/coop/MonthlyBars';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatTile, type TileTone } from '@/components/coop/StatTile';
import { formatDate } from '@/utils/format';
import type { AccountClass, LastEntry } from '@/lib/coop/types';

const SAVINGS_TONE: Record<AccountClass, TileTone> = { CONTRIBUTION: 'success', SHARES: 'info', SPECIAL: 'warning' };

function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** "+₦5,000.00 as at 4 Mar 2026": the last thing that moved on the tile. */
function lastEntryHint(entry: LastEntry | null, masked: boolean) {
  if (!entry) return 'Nothing recorded yet';
  return (
    <>
      {entry.type === 'WITHDRAWAL' ? '−' : '+'}
      <Naira value={entry.amount} masked={masked} /> as at {formatDate(entry.date)}
    </>
  );
}

/**
 * What a member sees at /dashboard/cooperatives: a tile for every savings type and loan category their cooperative offers, what they were
 * expected to pay each month against what they paid, and the year's activity. Officers get the association-wide dashboard instead.
 */
export default function MemberOverview() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [masked, setMasked] = useState(false);
  const dashboard = useCoopDashboard(year);
  const waiting = useMyPendingPayments({ status: 'PENDING' });

  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);
  const waitingCount = waiting.data?.pendingCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHead
        title={`${greeting()}${dashboard.data?.memberName ? `, ${dashboard.data.memberName.split(' ')[0]}` : ''}!`}
        subtitle="Track your cooperative contributions, loans, and financial progress."
        actions={
          <>
            <Button variant="default" leftSection={<IconRefresh size={16} />} loading={dashboard.isFetching && !dashboard.isLoading} onClick={() => dashboard.refetch()}>
              Refresh
            </Button>
            <Button variant="default" leftSection={masked ? <IconEye size={16} /> : <IconEyeOff size={16} />} onClick={() => setMasked((m) => !m)} aria-pressed={masked}>
              {masked ? 'Show' : 'Hide'}
            </Button>
          </>
        }
      />

      {dashboard.isLoading ? (
        <CoopLoading rows={4} height={96} />
      ) : dashboard.isError || !dashboard.data ? (
        <CoopError error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-line bg-success-soft p-4">
            <div className="flex items-center gap-3">
              <IconCoin size={28} className="text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-success-text">Monthly contribution</p>
                <p className="text-2xl font-bold text-success-strong">
                  <Naira value={dashboard.data.monthlyContribution} masked={masked} />
                </p>
              </div>
            </div>
            <Button component={Link} href="/dashboard/cooperatives/bank-accounts" variant="default" leftSection={<IconBuildingBank size={16} />}>
              Where to pay
            </Button>
          </div>

          {waitingCount > 0 && (
            <Link
              href="/dashboard/cooperatives/my-pending-payments"
              className="block rounded-lg border border-warning-line bg-warning-soft p-4 text-sm text-warning-strong hover:underline"
            >
              {waitingCount} payment{waitingCount > 1 ? 's are' : ' is'} waiting for an officer to confirm the money arrived. See your pending payments.
            </Link>
          )}

          <section aria-label="Your balances" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboard.data.savingsTiles.map((tile) => (
              <StatTile
                key={`s${tile.accountTypeId}`}
                label={tile.name}
                value={tile.balance}
                tone={SAVINGS_TONE[tile.accountClass]}
                icon={tile.accountClass === 'SHARES' ? <IconTrendingUp size={20} /> : <IconPigMoney size={20} />}
                hint={lastEntryHint(tile.lastEntry, masked)}
                masked={masked}
              />
            ))}
            {dashboard.data.loanTiles.map((tile) => (
              <StatTile
                key={`l${tile.loanCategoryId}`}
                label={tile.name}
                value={tile.outstanding}
                tone={Number(tile.outstanding) > 0 ? 'danger' : 'neutral'}
                icon={<IconWallet size={20} />}
                hint={
                  <>
                    {tile.isGoods ? 'Goods loans owed' : 'Loans owed'}
                    {tile.activeLoans > 0 ? ` · ${tile.activeLoans} active` : ''}
                  </>
                }
                masked={masked}
              />
            ))}
          </section>

          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Contribution table</h2>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Year
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ContributionTable table={dashboard.data.contributionTable} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <MonthlyBars title="My contributions" subtitle={`Monthly contribution activity, ${year}`} data={dashboard.data.charts.savingsByMonth.CONTRIBUTION} />
            <MonthlyBars title="Loan repayments" subtitle={`What you paid towards loans, ${year}`} data={dashboard.data.charts.loansByMonth.repaid} tone="info" />
            <MonthlyBars title="Special savings" subtitle={`Special contribution activity, ${year}`} data={dashboard.data.charts.savingsByMonth.SPECIAL} />
            <MonthlyBars title="Loans collected" subtitle={`Loans paid out to you, ${year}`} data={dashboard.data.charts.loansByMonth.disbursed} tone="info" />
          </div>
        </>
      )}
    </div>
  );
}
