import { useRouter } from 'expo-router';
import { ChartPie, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { PollRow } from '@/features/electionsManage/components/Rows';
import { POLL_STATUS_OPTIONS } from '@/features/electionsManage/labels';
import { VOTING_MODULE } from '@/features/electionsManage/queries';
import { usePollsInfinite } from '@/features/voting/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { PollListItemDTO } from '@/types/api/voting';

/** project-overview.md §6.10 GV10 — every poll of the association: open ones, drafts and the ones that have closed. */
export default function PollsAdminScreen() {
  const router = useRouter();
  const allowed = useModuleAccess('POLL_MANAGE', VOTING_MODULE);
  const [status, setStatus] = useState('');
  const query = usePollsInfinite({ status: status || undefined });
  const polls = useMemo(() => query.data?.pages.flatMap((p) => p.polls) ?? [], [query.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/polls/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Polls" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Polls" onBack={back} docsKey="GV10" rightActions={<IconButton icon={Plus} accessibilityLabel="Add a poll" onPress={() => go('form')} testID="polls-new" />} />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
          {POLL_STATUS_OPTIONS.map((s) => (
            <FilterChip key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(status === s.value ? '' : s.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={polls}
        keyOf={(p) => String(p.id)}
        skeletonHeight={88}
        renderItem={(p: PollListItemDTO, i, n) => <PollRow item={p} position={positionOf(i, n)} onPress={(poll) => go(`${poll.id}`)} />}
        empty={
          <EmptyState
            icon={ChartPie}
            title={status ? 'No polls here' : 'No polls yet'}
            description={status ? 'Try another filter.' : 'A poll asks members one quick question, like which day to meet.'}
            actionLabel={!status ? 'Add a poll' : undefined}
            onAction={!status ? () => go('form') : undefined}
          />
        }
      />
    </Screen>
  );
}
