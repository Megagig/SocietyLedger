import { useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { ApplicationRow } from '@/features/coopManage/components/Rows';
import { APPLICATION_FILTERS } from '@/features/coopManage/labels';
import { COOP_LOANS_ACCESS, COOP_MODULE, useApplications } from '@/features/coopManage/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { OfficerApplicationDTO } from '@/types/api/coopManage';
import type { LoanApplicationStatus } from '@/types/api/loans';

/** project-overview.md §6.9 CP4 — loan applications: the ones waiting for a decision first, then approved, paid out and rejected. */
export default function ApplicationsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const [status, setStatus] = useState<LoanApplicationStatus | ''>('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useApplications({ status: status || undefined, search: term || undefined });
  const applications = useMemo(() => query.data?.pages.flatMap((p) => p.applications) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan applications" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Loan applications" onBack={back} docsKey="CP4" />

      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search member or application number" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {APPLICATION_FILTERS.map((f) => (
            <FilterChip key={f.label} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={applications}
        keyOf={(a) => String(a.id)}
        skeletonHeight={84}
        renderItem={(a: OfficerApplicationDTO, i, n) => (
          <ApplicationRow item={a} position={positionOf(i, n)} onPress={(application) => router.push(`/(app)/(tabs)/manage/cooperatives/applications/${application.id}` as never)} />
        )}
        empty={
          <EmptyState
            icon={FileText}
            title={status === 'PENDING_REVIEW' ? 'Nothing waiting for review' : 'No applications here'}
            description={status === 'PENDING_REVIEW' ? 'When a member applies for a loan and their guarantors accept, it shows up here.' : 'Try another filter or a different search.'}
          />
        }
      />
    </Screen>
  );
}
