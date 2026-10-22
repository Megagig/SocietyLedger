import { View } from 'react-native';

import { ListGroup } from '@/components/layout/ListItem';
import { toDecimal } from '@/lib/money';
import { useMemberCooperative } from '../queries';
import { FactRow } from './FactRow';
import { TabState } from './TabState';

/** MG2 Cooperative tab — savings, loans and guarantor exposure. Money rows only; the officer tools for them land in Phase 6. */
export function MemberCooperativeTab({ memberId }: { memberId: number }) {
  const query = useMemberCooperative(memberId, true);
  const profile = query.data;

  return (
    <TabState isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => query.refetch()}>
      {profile ? (
        <View className="gap-6">
          <ListGroup>
            <FactRow label="Total savings" amount={profile.totalSavings} />
            <FactRow label="Available to withdraw" amount={profile.availableSavings} />
            <FactRow label="Held against loans" amount={profile.lockedSavings} />
            <FactRow label="Savings accounts" value={String(profile.savingsAccounts.length)} />
          </ListGroup>
          <ListGroup>
            <FactRow label="Active loans" value={String(profile.activeLoans.length)} />
            <FactRow label="Loan balance" amount={profile.totalOutstandingLoans} danger={toDecimal(profile.totalOutstandingLoans).gt(0)} />
            <FactRow label="Guaranteed for others" amount={profile.guarantorExposure} />
            <FactRow label="Credit score" value={`${profile.creditScore} / 100`} />
          </ListGroup>
        </View>
      ) : null}
    </TabState>
  );
}
