import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { SavingsView } from '@/features/ajo/components/savings/SavingsView';
import { AJO_MEMBER_ACCESS, useMyMemberships } from '@/features/ajo/queries';

/** A collector-thrift saver's own view of their savings (spec §16.6): where they stand, where their cash is, and what they will get back. */
export default function MySavingsScreen() {
  const params = useLocalSearchParams<{ membershipId?: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);

  return (
    <AjoScreen title="My savings" access={AJO_MEMBER_ACCESS}>
      {mine.isPending ? (
        <AjoLoading />
      ) : !item ? (
        <EmptyState title="We could not find that circle." description="It may not be one of yours." />
      ) : item.group.model !== 'COLLECTOR_THRIFT' ? (
        <EmptyState title="Savings are for collector-thrift groups." description="A rotating pot shows the circle board instead." />
      ) : (
        <SavingsView membershipId={membershipId} />
      )}
    </AjoScreen>
  );
}
