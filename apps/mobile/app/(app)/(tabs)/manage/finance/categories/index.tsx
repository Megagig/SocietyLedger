import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Plus, Tags } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { CategoryRow } from '@/features/financeSetup/components/CategoryRow';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { CATEGORY_KIND_LABELS, CATEGORY_KIND_OPTIONS } from '@/features/financeSetup/labels';
import { FINANCE_VIEW_ACCESS, SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCategories } from '@/features/financeSetup/queries';
import { useCan } from '@/hooks/useCan';
import type { CategoryDTO, CategoryKind } from '@/types/api/financeSetup';

type ActiveFilter = '' | 'true' | 'false';

/** project-overview.md §6.9 FN6 — every charge category: dues, levies, donations and penalties, with its default amount and how much it is used. */
export default function CategoriesScreen() {
  const router = useRouter();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canCreate = useCan(SETUP_CREATE_ACCESS);
  const canEdit = useCan(SETUP_EDIT_ACCESS);
  const [kind, setKind] = useState<CategoryKind | ''>('');
  const [active, setActive] = useState<ActiveFilter>('');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useCategories({ type: kind || undefined, isActive: active === '' ? undefined : active === 'true', search: term || undefined });
  const categories = useMemo(() => query.data?.pages.flatMap((page) => page.categories) ?? [], [query.data]);
  const back = () => router.back();
  const openNew = () => router.push(`/(app)/(tabs)/manage/finance/categories/form${kind ? `?type=${kind}` : ''}` as never);
  const open = (category: CategoryDTO) => router.push(`/(app)/(tabs)/manage/finance/categories/form?id=${category.id}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Categories" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = kind !== '' || active !== '' || term !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Categories"
        onBack={back}
        docsKey="FN6"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Add a category" onPress={openNew} testID="categories-new" /> : undefined}
      />

      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search categories" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All types" active={kind === ''} onPress={() => setKind('')} />
          {CATEGORY_KIND_OPTIONS.map((k) => (
            <FilterChip key={k} label={CATEGORY_KIND_LABELS[k]} active={kind === k} onPress={() => setKind(kind === k ? '' : k)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="Any status" active={active === ''} onPress={() => setActive('')} />
          <FilterChip label="Active" active={active === 'true'} onPress={() => setActive(active === 'true' ? '' : 'true')} />
          <FilterChip label="Inactive" active={active === 'false'} onPress={() => setActive(active === 'false' ? '' : 'false')} />
        </ScrollView>
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={categories}
          keyExtractor={(category) => String(category.id)}
          renderItem={({ item, index }) => <CategoryRow category={item} position={positionOf(index, categories.length)} onPress={canEdit ? open : undefined} />}
          ListEmptyComponent={
            <EmptyState
              icon={Tags}
              title={filtered ? 'No categories match' : 'No categories yet'}
              description={filtered ? 'Try clearing a filter or a different search.' : 'Categories are the kinds of dues, levies, donations and penalties you charge. Add one to start charging members.'}
              actionLabel={!filtered && canCreate ? 'Add a category' : undefined}
              onAction={!filtered && canCreate ? openNew : undefined}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
