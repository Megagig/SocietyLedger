import { Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup } from '@/components/layout/ListItem';
import { StatTile } from '@/components/ui/StatTile';
import { formatMoney, toDecimal } from '@/lib/money';
import { useMemberFinance } from '../queries';
import { FactRow } from './FactRow';
import { TabState } from './TabState';

/** MG2 Finance tab — what this member has been charged, has paid and still owes, by category. */
export function MemberFinanceTab({ memberId }: { memberId: number }) {
  const query = useMemberFinance(memberId, true);
  const data = query.data;
  const categories = data ? Object.entries(data.byCategory) : [];

  return (
    <TabState isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => query.refetch()}>
      {data && categories.length === 0 ? (
        <EmptyState icon={Wallet} title="No charges yet" description="Dues and levies charged to this member show up here." />
      ) : data ? (
        <View className="gap-6">
          <View className="flex-row gap-3">
            <StatTile label="Charged" value={formatMoney(data.summary.totalDues, { compact: true })} tone="info" />
            <StatTile label="Paid" value={formatMoney(data.summary.totalPaid, { compact: true })} tone="success" />
            <StatTile label="Owes" value={formatMoney(data.summary.balance, { compact: true })} tone={toDecimal(data.summary.balance).gt(0) ? 'warning' : 'primary'} />
          </View>
          <ListGroup>
            <FactRow label="Unpaid charges" value={String(data.summary.pendingCount)} />
            <FactRow label="Overdue charges" value={String(data.summary.overdueCount)} />
          </ListGroup>
          <ListGroup>
            {categories.map(([name, totals]) => (
              <FactRow key={name} label={name} amount={totals.pending} danger={toDecimal(totals.pending).gt(0)} />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </TabState>
  );
}
