import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { EntryRow } from '@/features/accounting/components/Rows';
import { ACCOUNTING_CREATE_ACCESS, JOURNAL_FILTER_OPTIONS } from '@/features/accounting/labels';
import { useAccountingAccess, useEntriesInfinite } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import type { JournalEntryDTO, JournalStatus } from '@/types/api/accounting';

const STATUSES = JOURNAL_FILTER_OPTIONS.map((o) => o.value);

/** project-overview.md §6.9 AC3 — every journal entry, newest first, by where it stands. Tap one to read it, approve it or post it. */
export default function JournalListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const [status, setStatus] = useState<JournalStatus | 'ALL'>(STATUSES.includes(params.status as JournalStatus) ? (params.status as JournalStatus) : 'ALL');
  const [search, setSearch] = useState('');
  const query = useEntriesInfinite(status, search.trim());
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.entries) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Journal entries" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = status !== 'ALL' || search.trim() !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Journal entries"
        onBack={back}
        docsKey="AC3"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Write an entry" onPress={() => router.push('/(app)/(tabs)/manage/accounting/journal/form' as never)} testID="journal-new" /> : undefined}
      />
      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by number or description" testID="journal-search" />
        <View className="flex-row">
          <OptionDropdown label="Show" value={status} options={JOURNAL_FILTER_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} onChange={(v) => setStatus(v as JournalStatus | 'ALL')} testID="journal-status" />
        </View>
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(e) => String(e.id)}
        skeletonHeight={84}
        renderItem={(e: JournalEntryDTO, i, n) => (
          <EntryRow item={e} position={positionOf(i, n)} onPress={(item) => router.push({ pathname: '/(app)/(tabs)/manage/accounting/journal/[id]', params: { id: String(item.id) } } as never)} />
        )}
        empty={
          <EmptyState
            icon={BookOpen}
            title={filtered ? 'No entries match' : 'No entries yet'}
            description={filtered ? 'Try another filter.' : 'Entries appear as money moves, or when an officer writes one.'}
            actionLabel={canCreate && !filtered ? 'Write an entry' : undefined}
            onAction={canCreate && !filtered ? () => router.push('/(app)/(tabs)/manage/accounting/journal/form' as never) : undefined}
          />
        }
      />
    </Screen>
  );
}
