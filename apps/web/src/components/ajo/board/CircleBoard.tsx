'use client';

import { Tabs } from '@mantine/core';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { useBoardOverview } from '@/lib/ajo/boardHooks';
import { BoardActivityView } from './BoardActivity';
import { BoardArrearsView } from './BoardArrears';
import { BoardChartsView } from './BoardCharts';
import { BoardOverview } from './BoardOverview';
import { BoardMembersView, BoardPayoutsView } from './BoardPayouts';
import { BoardMatrixView, BoardRoundView } from './BoardRound';

const codeOf = (error: unknown): string | undefined => (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

/**
 * The Circle board (spec §16.4): what every member of a rotating pot sees about their own circle. Read-only. Used on the member's circle
 * page and on the officer's, with the same figures, because both come from the same API.
 */
export function CircleBoard({ groupId }: { groupId: number }) {
  const overview = useBoardOverview(groupId);
  if (overview.isLoading) return <AjoLoading rows={4} />;

  if (overview.isError) {
    const code = codeOf(overview.error);
    if (code === 'BOARD_NOT_AVAILABLE') {
      return <AjoEmpty title="There is no circle board for this group." hint="A collector-thrift scheme keeps each saver's records private. You can see your own savings on your circle page." />;
    }
    if (code === 'BOARD_OFF') {
      return <AjoEmpty title="The circle board is switched off." hint="The admin has not turned on the circle board for this circle. Ask them if you would like members to see each other's progress." />;
    }
    return <AjoError error={overview.error} onRetry={() => overview.refetch()} />;
  }

  return (
    <Tabs defaultValue="overview" keepMounted={false}>
      <Tabs.List className="mb-5 flex-wrap">
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="round">This round</Tabs.Tab>
        <Tabs.Tab value="history">Payment history</Tabs.Tab>
        <Tabs.Tab value="payouts">Payouts</Tabs.Tab>
        <Tabs.Tab value="members">Members</Tabs.Tab>
        <Tabs.Tab value="arrears">Arrears</Tabs.Tab>
        <Tabs.Tab value="charts">Charts</Tabs.Tab>
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="overview"><BoardOverview groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="round"><BoardRoundView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="history"><BoardMatrixView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="payouts"><BoardPayoutsView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="members"><BoardMembersView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="arrears"><BoardArrearsView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="charts"><BoardChartsView groupId={groupId} /></Tabs.Panel>
      <Tabs.Panel value="activity"><BoardActivityView groupId={groupId} /></Tabs.Panel>
    </Tabs>
  );
}
