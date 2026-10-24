import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { ScrollText } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { AuditRow } from '@/features/rbac/components/Rows';
import { actionLabel, actorName, areaLabel, AUDIT_ACCESS, AUDIT_ACTION_OPTIONS, AUDIT_RANGE_OPTIONS, auditFrom, changeLines, type AuditActionFilter, type AuditRange } from '@/features/rbac/labels';
import { useAuditFilters, useAuditInfinite } from '@/features/rbac/queries';
import { formatDate } from '@/lib/dates';
import { useCan } from '@/hooks/useCan';
import type { AuditLogDTO } from '@/types/api/rbac';

const ALL_AREAS = '__all__';

/** project-overview.md §6.9 ST9 — who did what, and when, in this association. Newest first; tap an entry to see what changed. */
export default function AuditScreen() {
  const router = useRouter();
  const allowed = useCan(AUDIT_ACCESS);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState<string>(ALL_AREAS);
  const [range, setRange] = useState<AuditRange>('all');
  const [action, setAction] = useState<AuditActionFilter>('all');
  const [selected, setSelected] = useState<AuditLogDTO | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const filters = useAuditFilters();
  // The start of "today" and "last 7 days" is worked out when the choice is made, so the list does not refetch on every render.
  const [from, setFrom] = useState<string | undefined>(undefined);
  const query = useAuditInfinite({ search: search.trim(), action: action === 'all' ? '' : action, tableName: area === ALL_AREAS ? '' : area, from });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.logs) ?? [], [query.data]);
  const back = () => router.back();

  useEffect(() => {
    if (selected) sheetRef.current?.present();
  }, [selected]);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Audit log" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const areaOptions = [{ label: 'All areas', value: ALL_AREAS }, ...(filters.data?.tables ?? []).map((t) => ({ label: areaLabel(t), value: t }))];
  const lines = selected ? changeLines(selected) : [];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Audit log" onBack={back} docsKey="ST9" />
      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by activity or person" testID="audit-search" />
        <View className="flex-row gap-3">
          <OptionDropdown label="Action" value={action} options={[...AUDIT_ACTION_OPTIONS]} onChange={setAction} testID="audit-action" />
          <OptionDropdown label="Area" value={area} options={areaOptions} onChange={setArea} testID="audit-area" />
        </View>
        <OptionDropdown
          label="When"
          value={range}
          options={[...AUDIT_RANGE_OPTIONS]}
          onChange={(next) => {
            setRange(next);
            setFrom(auditFrom(next));
          }}
          testID="audit-range"
        />
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(l) => String(l.id)}
        skeletonHeight={72}
        renderItem={(l: AuditLogDTO, i, n) => <AuditRow item={l} position={positionOf(i, n)} onPress={setSelected} />}
        empty={
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded"
            description={search.trim() || action !== 'all' || area !== ALL_AREAS || range !== 'all' ? 'Nothing matches these filters. Try widening them.' : 'Activity appears here as officers make changes.'}
          />
        }
      />

      <BottomSheet ref={sheetRef} title={selected ? actionLabel(selected.action) : 'Activity'} snapPoints={['60%']} onDismiss={() => setSelected(null)}>
        {selected ? (
          <View className="gap-3 pb-6">
            <Text variant="caption" tone="secondary">
              {actorName(selected)} · {areaLabel(selected.tableName)} · {formatDate(selected.createdAt, 'long')}, {formatDate(selected.createdAt, 'time')}
            </Text>
            {selected.recordId ? (
              <Text variant="caption" tone="secondary" testID="audit-record-id">
                Record number {selected.recordId}
              </Text>
            ) : null}
            {lines.length === 0 ? (
              <Text variant="body" tone="secondary">
                No details were recorded for this.
              </Text>
            ) : (
              lines.map((line, i) => (
                <Text key={`${i}-${line}`} variant="body">
                  {line}
                </Text>
              ))
            )}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
