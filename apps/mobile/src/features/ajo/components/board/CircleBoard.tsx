import { LockKeyhole, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { boardClosedReason, useBoardOverview } from '../../boardQueries';
import { AjoLoading } from '../AjoStates';
import { ActivityView, ArrearsView, ChartsView, MatrixView, MembersView, OverviewView, PayoutsView, RoundView } from './BoardViews';

type ViewKey = 'overview' | 'round' | 'history' | 'payouts' | 'members' | 'arrears' | 'charts' | 'activity';

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'round', label: 'This round' },
  { key: 'history', label: 'History' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'members', label: 'Members' },
  { key: 'arrears', label: 'Arrears' },
  { key: 'charts', label: 'Charts' },
  { key: 'activity', label: 'Activity' },
];

/**
 * The Circle board (spec §16.4): what every member of a rotating pot sees about their own circle. Read-only. The same screens serve the
 * standalone group's Circle tab and the circle page of an association member, so both see the same facts the web shows.
 */
export function CircleBoard({ groupId }: { groupId: number }) {
  const overview = useBoardOverview(groupId);
  const [view, setView] = useState<ViewKey>('overview');

  if (overview.isPending) return <AjoLoading rows={4} />;
  if (overview.isError) {
    const closed = boardClosedReason(overview.error);
    if (closed === 'NOT_AVAILABLE') {
      return <EmptyState icon={LockKeyhole} title="There is no circle board for this group." description="A collector-thrift scheme keeps each saver's records private. You can see your own savings on your circle page." />;
    }
    if (closed === 'OFF') {
      return <EmptyState icon={Users} title="The circle board is switched off." description="The admin has not turned on the circle board for this circle. Ask them if you would like members to see each other's progress." />;
    }
    return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  }

  return (
    <View className="gap-4" testID="circle-board">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
        {VIEWS.map((v) => (
          <FilterChip key={v.key} label={v.label} active={v.key === view} onPress={() => setView(v.key)} />
        ))}
      </ScrollView>
      {view === 'overview' ? <OverviewView groupId={groupId} /> : null}
      {view === 'round' ? <RoundView groupId={groupId} /> : null}
      {view === 'history' ? <MatrixView groupId={groupId} /> : null}
      {view === 'payouts' ? <PayoutsView groupId={groupId} /> : null}
      {view === 'members' ? <MembersView groupId={groupId} /> : null}
      {view === 'arrears' ? <ArrearsView groupId={groupId} /> : null}
      {view === 'charts' ? <ChartsView groupId={groupId} /> : null}
      {view === 'activity' ? <ActivityView groupId={groupId} /> : null}
    </View>
  );
}
