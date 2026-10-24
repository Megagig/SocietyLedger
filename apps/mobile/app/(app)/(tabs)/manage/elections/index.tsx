import { useRouter } from 'expo-router';
import { Hourglass, Plus, Trophy, Vote } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { StatTile } from '@/components/ui/StatTile';
import { Badge } from '@/components/ui/Badge';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { ElectionRow } from '@/features/electionsManage/components/Rows';
import { ELECTION_ADMIN_ACCESS, ELECTION_STATUS_OPTIONS } from '@/features/electionsManage/labels';
import { useAdminElections, useVotingDashboard, VOTING_MODULE } from '@/features/electionsManage/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { ElectionStatus } from '@/types/api/enums';
import type { ElectionListItemDTO } from '@/types/api/voting';

/**
 * project-overview.md §6.10 GV7 — every election of the association, with what is waiting for the Election Committee: nominations to
 * decide, voting that has run past its end date, and results to publish.
 */
export default function ElectionsAdminScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(ELECTION_ADMIN_ACCESS, VOTING_MODULE);
  const canCreate = useCan('ELECTION_MANAGE');
  const [status, setStatus] = useState<ElectionStatus | ''>('');
  const dashboard = useVotingDashboard();
  const query = useAdminElections({ status: status || undefined });
  const elections = useMemo(() => query.data?.pages.flatMap((p) => p.elections) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/elections/${path}` as never);
  const data = dashboard.data;

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Elections" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const header = data ? (
    <View className="gap-4 pb-4">
      <View className="flex-row gap-3">
        <StatTile label="Voting now" value={String(data.activeElections)} tone="success" testID="elections-active" />
        <StatTile label="Elections held" value={String(data.completedElections)} tone="info" />
        <StatTile label="Usual turnout" value={`${data.averageVoterTurnout}%`} tone="primary" />
      </View>
      {data.candidatesAwaitingApproval + data.votingPastEnd + data.resultsToPublish > 0 ? (
        <ListGroup>
          {data.candidatesAwaitingApproval > 0 ? (
            <ListItem
              leading={<IconCircle icon={Vote} tone="warning" />}
              title="Nominations to decide"
              meta="Open the election to approve or reject them"
              trailing={<Badge tone="warning">{String(data.candidatesAwaitingApproval)}</Badge>}
              testID="elections-nominations"
            />
          ) : null}
          {data.votingPastEnd > 0 ? (
            <ListItem
              leading={<IconCircle icon={Hourglass} tone="warning" />}
              title="Voting has ended"
              meta="Close voting so the results can be counted"
              trailing={<Badge tone="warning">{String(data.votingPastEnd)}</Badge>}
              showChevron
              onPress={() => setStatus('VOTING_OPEN')}
              testID="elections-to-close"
            />
          ) : null}
          {data.resultsToPublish > 0 ? (
            <ListItem
              leading={<IconCircle icon={Trophy} tone="info" />}
              title="Results to publish"
              meta="Voting has closed"
              trailing={<Badge tone="info">{String(data.resultsToPublish)}</Badge>}
              showChevron
              onPress={() => setStatus('VOTING_CLOSED')}
              testID="elections-to-publish"
            />
          ) : null}
        </ListGroup>
      ) : null}
    </View>
  ) : undefined;

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Elections"
        onBack={back}
        docsKey="GV7"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Add an election" onPress={() => go('form')} testID="elections-new" /> : undefined}
      />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
          {ELECTION_STATUS_OPTIONS.map((s) => (
            <FilterChip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={elections}
        keyOf={(e) => String(e.id)}
        skeletonHeight={96}
        header={header}
        renderItem={(e: ElectionListItemDTO, i, n) => <ElectionRow item={e} position={positionOf(i, n)} onPress={(election) => go(`${election.id}`)} />}
        empty={
          <EmptyState
            icon={Vote}
            title={status ? 'No elections here' : 'No elections yet'}
            description={status ? 'Try another filter.' : 'An election lets members nominate candidates and vote for the people who will lead the association.'}
            actionLabel={!status && canCreate ? 'Add an election' : undefined}
            onAction={!status && canCreate ? () => go('form') : undefined}
          />
        }
      />
    </Screen>
  );
}
