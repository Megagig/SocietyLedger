import { View } from 'react-native';

import { ListGroup } from '@/components/layout/ListItem';
import { formatDate } from '@/lib/dates';
import { useMemberWelfare } from '../queries';
import { FactRow } from './FactRow';
import { TabState } from './TabState';

/** MG2 Welfare tab — what this member has given to and received from the welfare funds. */
export function MemberWelfareTab({ memberId }: { memberId: number }) {
  const query = useMemberWelfare(memberId, true);
  const profile = query.data;

  return (
    <TabState isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => query.refetch()}>
      {profile ? (
        <View className="gap-6">
          <ListGroup>
            <FactRow label="Contributed" amount={profile.totalContributions} />
            <FactRow label="Contributions" value={String(profile.contributionCount)} />
            <FactRow label="Last contribution" value={profile.lastContributionDate ? formatDate(profile.lastContributionDate, 'long') : null} />
          </ListGroup>
          <ListGroup>
            <FactRow label="Received" amount={profile.totalPayoutsReceived} />
            <FactRow label="Payouts" value={String(profile.payoutCount)} />
            <FactRow label="Requests waiting" value={String(profile.pendingRequests)} />
          </ListGroup>
        </View>
      ) : null}
    </TabState>
  );
}
