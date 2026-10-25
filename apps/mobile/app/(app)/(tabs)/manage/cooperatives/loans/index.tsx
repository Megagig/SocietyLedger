import { useLocalSearchParams, useRouter } from 'expo-router';
import { Landmark } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatTile } from '@/components/ui/StatTile';
import { LoanRow } from '@/features/coopManage/components/Rows';
import { LOAN_FILTERS } from '@/features/coopManage/labels';
import { COOP_LOANS_ACCESS, COOP_MODULE, useCoopDashboard, useLoans } from '@/features/coopManage/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import type { OfficerLoanDTO } from '@/types/api/coopManage';
import type { LoanStatus } from '@/types/api/loans';

/** project-overview.md §6.9 CP5 — every loan the cooperative has paid out: who owes what, and how much is repaid. */
export default function LoansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const [status, setStatus] = useState<LoanStatus | ''>(LOAN_FILTERS.some((f) => f.value === params.status) ? (params.status as LoanStatus) : '');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useLoans({ status: status || undefined, search: term || undefined });
  const summary = useCoopDashboard().data?.loansSummary;
  const loans = useMemo(() => query.data?.pages.flatMap((p) => p.loans) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loans" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = status !== '' || term !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Loans" onBack={back} docsKey="CP5" />

      <View className="gap-3 pb-3">
        {summary ? (
          <View className="flex-row gap-2">
            <StatTile label="Still owed" value={formatMoney(summary.totalOutstanding)} tone="info" />
            <StatTile label="Overdue" value={String(summary.overdueLoans)} tone="warning" />
          </View>
        ) : null}
        <SearchField value={search} onChangeText={setSearch} placeholder="Search member or loan number" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LOAN_FILTERS.map((f) => (
            <FilterChip key={f.label} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={loans}
        keyOf={(l) => String(l.id)}
        skeletonHeight={92}
        renderItem={(l: OfficerLoanDTO, i, n) => <LoanRow item={l} position={positionOf(i, n)} onPress={(loan) => router.push(`/(app)/(tabs)/manage/cooperatives/loans/${loan.id}` as never)} />}
        empty={
          <EmptyState
            icon={Landmark}
            title={filtered ? 'No loans match' : 'No loans yet'}
            description={filtered ? 'Try another filter or a different search.' : 'When you approve an application and pay it out, the loan appears here.'}
          />
        }
      />
    </Screen>
  );
}
