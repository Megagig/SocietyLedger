import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ban, BarChart2, CircleCheck, CircleDot, LayoutGrid, ListChecks, ListFilter, Lock, PenLine, Star, ThumbsUp } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { format, isPast } from 'date-fns';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FilterDropdown, type FilterDropdownOption } from '@/components/forms/FilterDropdown';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { usePollsInfinite } from '@/features/voting/queries';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { PollListItemDTO } from '@/types/api/voting';

type StatusValue = '' | 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'CANCELLED';
type TypeValue = '' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'YES_NO';

const STATUS_OPTIONS: FilterDropdownOption<StatusValue>[] = [
  { label: 'All statuses', value: '', icon: ListFilter, hint: 'Show polls in any state' },
  { label: 'Active', value: 'ACTIVE', icon: CircleCheck, hint: 'Open for responses now' },
  { label: 'Closed', value: 'CLOSED', icon: Lock, hint: 'Voting has ended' },
  { label: 'Draft', value: 'DRAFT', icon: PenLine, hint: 'Not published yet' },
  { label: 'Cancelled', value: 'CANCELLED', icon: Ban, hint: 'Called off by an admin' },
];

// Same four poll types as the web filter (voting.validation.ts pollTypes).
const TYPE_OPTIONS: FilterDropdownOption<TypeValue>[] = [
  { label: 'All types', value: '', icon: LayoutGrid, hint: 'Show every kind of poll' },
  { label: 'Single choice', value: 'SINGLE_CHOICE', icon: CircleDot, hint: 'Pick one option' },
  { label: 'Multiple choice', value: 'MULTIPLE_CHOICE', icon: ListChecks, hint: 'Pick any that apply' },
  { label: 'Rating', value: 'RATING', icon: Star, hint: 'Rate on a scale' },
  { label: 'Yes/No', value: 'YES_NO', icon: ThumbsUp, hint: 'A simple yes or no' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

function PollCard({ poll, onPress }: { poll: PollListItemDTO; onPress: () => void }) {
  const { color } = useThemeTokens();
  const closed = isPast(new Date(poll.endDate));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" android_ripple={{ color: `${color.primary}1F` }}>
      <Card className="gap-2">
        <View className="flex-row items-start justify-between gap-2">
          <Text variant="body-strong" numberOfLines={2} className="flex-1">
            {poll.title}
          </Text>
          <StatusChip status={poll.status} />
        </View>

        {poll.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {poll.description}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-2">
          <Badge tone="primary">{TYPE_LABELS[poll.pollType] ?? poll.pollType}</Badge>
          <Text variant="micro" tone="tertiary">
            {`${closed ? 'Closed' : 'Closes'} ${format(new Date(poll.endDate), 'd MMM yyyy')}`}
          </Text>
          <Text variant="micro" tone="tertiary">
            {`· ${poll._count.responses} response${poll._count.responses === 1 ? '' : 's'}`}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

/** project-overview.md §6.5 C9 — Polls list with search + status/type filters (web `governance/polls`). */
export default function PollsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusValue>('');
  const [pollType, setPollType] = useState<TypeValue>('');

  const filtersActive = search.trim() !== '' || status !== '' || pollType !== '';
  const query = usePollsInfinite({
    search: search.trim() || undefined,
    status: status || undefined,
    pollType: pollType || undefined,
  });
  const polls = query.data?.pages.flatMap((p) => p.polls) ?? [];
  const locked = useModuleDisabled('voting');

  if (locked) return <ModuleLockedScreen title={t('polls.title')} moduleName="Polls" onBack={() => router.back()} />;

  const header = (
    <View className="gap-3 pb-4">
      <SearchField value={search} onChangeText={setSearch} placeholder="Search polls…" />
      <View className="flex-row gap-3">
        <FilterDropdown label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} defaultValue="" />
        <FilterDropdown label="Type" value={pollType} options={TYPE_OPTIONS} onChange={setPollType} defaultValue="" />
      </View>
    </View>
  );

  let empty: React.ReactElement;
  if (query.isPending) {
    empty = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={96} radius="lg" />
        ))}
      </View>
    );
  } else if (query.isError) {
    empty = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  } else if (filtersActive) {
    empty = (
      <EmptyState
        icon={BarChart2}
        title="No polls found"
        description="Try adjusting your search or filters."
        actionLabel="Clear filters"
        onAction={() => {
          setSearch('');
          setStatus('');
          setPollType('');
        }}
      />
    );
  } else {
    empty = <EmptyState icon={BarChart2} title={t('polls.empty')} description="Polls from your association will appear here." />;
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={t('polls.title')} onBack={() => router.back()} />

      <FlatList
        data={query.isSuccess ? polls : []}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : undefined}
        renderItem={({ item }) => (
          <View className="pb-3">
            <PollCard poll={item} onPress={() => router.push(`/(app)/(tabs)/community/polls/${item.id}` as never)} />
          </View>
        )}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
