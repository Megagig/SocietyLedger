import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CoopTile } from '@/features/coopEnhanced/components/CoopTile';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { RangeFilter } from '@/features/coopEnhanced/components/RangeFilter';
import { shareCsv } from '@/features/coopEnhanced/csv';
import { useCoopTransactions } from '@/features/coopEnhanced/queries';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_OWN_PAGES_ACCESS } from '@/lib/permissions';
import type { CoopTransactionRowDTO, CoopTransactionsDTO } from '@/types/api/coopEnhanced';

type Tab = 'overview' | 'loans' | 'contributions' | 'shares';
const TABS: { label: string; value: Tab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Loans', value: 'loans' },
  { label: 'Contributions', value: 'contributions' },
  { label: 'Shares', value: 'shares' },
];

const isoDay = (d: Date) => {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  return { from: isoDay(from), to: isoDay(to) };
};

function Rows({ rows }: { rows: CoopTransactionRowDTO[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <View key={r.id}>
          {i > 0 ? <Divider /> : null}
          <View className="flex-row items-center px-4 py-3">
            <View className="flex-1">
              <Text variant="body-strong">{r.typeName}</Text>
              <Text variant="caption" tone="secondary">{formatDate(r.date, 'short')}</Text>
            </View>
            <Money value={r.amount} />
          </View>
        </View>
      ))}
    </>
  );
}

/**
 * My Transactions: your own contributions, shares and loans. The Overview adds up everything since you joined; the other tabs follow the
 * dates you choose. Every figure comes from the same records the officers use, so it can't disagree with the books.
 */
export default function MyTransactionsScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState(defaultRange);
  const query = useCoopTransactions(range);
  const d: CoopTransactionsDTO | undefined = query.data;

  const exportCsv = async () => {
    if (!d) return;
    try {
      if (tab === 'loans') {
        await shareCsv('my-loan-transactions', ['Date', 'Loan category', 'Loan title', 'Amount', 'Repaid', 'Balance'], d.loans.rows.map((r) => [isoDay(new Date(r.date)), r.category, r.title, r.amount, r.repaid, r.balance]));
      } else if (tab === 'contributions' || tab === 'shares') {
        const part = tab === 'contributions' ? d.contributions : d.shares;
        await shareCsv(`my-${tab}`, ['Date', 'Type', 'Member', 'Amount'], part.rows.map((r) => [isoDay(new Date(r.date)), r.typeName, r.memberName, r.amount]));
      } else {
        await shareCsv('my-transactions-overview', ['Category', 'Metric', 'Amount'], [
          ['Loans', 'Total loans disbursed', d.overview.loansDisbursed],
          ['Loans', 'Total loan repayments', d.overview.loanRepayments],
          ['Loans', 'Outstanding loan balance', d.overview.outstandingLoans],
          ['Contributions', 'Total contributions', d.overview.contributions],
          ['Shares', 'Total shares', d.overview.shares],
        ]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the file.');
    }
  };

  return (
    <OwnPage
      title="Transaction history"
      subject="transactions"
      access={COOPERATIVE_OWN_PAGES_ACCESS}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      rightActions={<IconButton icon={Download} accessibilityLabel="Export as a spreadsheet file" disabled={!d} onPress={() => void exportCsv()} testID="tx-export" />}
    >
      <View className="gap-4 pb-8">
        <Text variant="body" tone="secondary">
          Review your personal contribution, loan, and share activities.
        </Text>

        <SegmentedControl<Tab> options={TABS} value={tab} onChange={setTab} testID="tx-tabs" />
        {tab !== 'overview' ? <RangeFilter from={range.from} to={range.to} onApply={setRange} /> : null}

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={90} radius="lg" />
            <Skeleton width="100%" height={160} radius="lg" />
          </View>
        ) : query.isError || !d ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : tab === 'overview' ? (
          <View className="gap-3">
            <Text variant="caption" tone="secondary">All-time cumulative overview: your complete cooperative financial record.</Text>
            <View className="flex-row gap-3">
              <CoopTile label="Contributions" value={d.overview.contributions} tone="success" />
              <CoopTile label="Shares" value={d.overview.shares} tone="info" />
            </View>
            <View className="flex-row gap-3">
              <CoopTile label="Loans disbursed" value={d.overview.loansDisbursed} tone="neutral" />
              <CoopTile label="Outstanding loans" value={d.overview.outstandingLoans} tone={Number(d.overview.outstandingLoans) > 0 ? 'danger' : 'warning'} />
            </View>
            <Card noPadding>
              {(
                [
                  ['Total loans disbursed', d.overview.loansDisbursed],
                  ['Total loan repayments', d.overview.loanRepayments],
                  ['Outstanding loan balance', d.overview.outstandingLoans],
                  ['Total contributions', d.overview.contributions],
                  ['Total shares', d.overview.shares],
                ] as [string, string][]
              ).map(([metric, amount], i) => (
                <View key={metric}>
                  {i > 0 ? <Divider /> : null}
                  <View className="flex-row items-center justify-between px-4 py-3">
                    <Text variant="body">{metric}</Text>
                    <Money value={amount} />
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : tab === 'loans' ? (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <CoopTile label="Total loans" value={d.loans.totalLoans} tone="info" />
              <CoopTile label="Total repaid" value={d.loans.totalRepaid} tone="success" />
            </View>
            <CoopTile label="Outstanding balance" value={d.loans.outstandingBalance} tone="warning" />
            {d.loans.rows.length === 0 ? (
              <EmptyState title="No loan records found for this period." description="Try a wider range of dates." />
            ) : (
              <Card noPadding>
                {d.loans.rows.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 ? <Divider /> : null}
                    <View className="gap-1 px-4 py-3">
                      <Text variant="body-strong">{r.title}</Text>
                      <Text variant="caption" tone="secondary">{`${r.category} · ${formatDate(r.date, 'short')}`}</Text>
                      <View className="mt-1 flex-row justify-between">
                        <Text variant="caption" tone="secondary">Amount</Text>
                        <Money value={r.amount} size="caption" />
                      </View>
                      <View className="flex-row justify-between">
                        <Text variant="caption" tone="secondary">Repaid</Text>
                        <Money value={r.repaid} size="caption" />
                      </View>
                      <View className="flex-row justify-between">
                        <Text variant="caption" tone="secondary">Balance</Text>
                        <Money value={r.balance} size="caption" />
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </View>
        ) : (
          <View className="gap-3">
            <CoopTile label={tab === 'contributions' ? 'Total contributions' : 'Total shares'} value={(tab === 'contributions' ? d.contributions : d.shares).total} tone={tab === 'contributions' ? 'success' : 'info'} />
            {(tab === 'contributions' ? d.contributions : d.shares).rows.length === 0 ? (
              <EmptyState title={tab === 'contributions' ? 'No contributions found for this period.' : 'No share purchases found for this period.'} description="Try a wider range of dates." />
            ) : (
              <Card noPadding>
                <Rows rows={(tab === 'contributions' ? d.contributions : d.shares).rows} />
              </Card>
            )}
          </View>
        )}
        {d && tab !== 'overview' ? (
          <Text variant="caption" tone="secondary">{`Period: ${formatDate(range.from, 'short')} – ${formatDate(range.to, 'short')}`}</Text>
        ) : null}
      </View>
    </OwnPage>
  );
}
