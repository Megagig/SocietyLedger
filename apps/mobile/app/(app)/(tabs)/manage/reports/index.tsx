import { useRouter } from 'expo-router';
import { Clock3, FileDown, FolderTree, TrendingUp, Users, Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { DrillFigure } from '@/features/reports/components/Drill';
import { chargesHref, paymentsHref } from '@/features/reports/drill';
import { EXPORT_ANY_ACCESS } from '@/features/reports/labels';
import { useAging, useFinancialSummary, useReportsAccess } from '@/features/reports/queries';
import { useCan } from '@/hooks/useCan';

/**
 * project-overview.md §6.9 RP1 — Reports: this month at a glance, then each report. The three figures open the records behind them,
 * the same as the figures inside each report.
 */
export default function ReportsHubScreen() {
  const router = useRouter();
  const canReports = useReportsAccess();
  const canExports = useCan(EXPORT_ANY_ACCESS);
  const summary = useFinancialSummary(canReports ? { period: 'this_month' } : null);
  const aging = useAging();
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/reports/${path}` as never);

  if (!canReports && !canExports) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Reports" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const range = summary.data ? { startDate: summary.data.period.startDate, endDate: summary.data.period.endDate } : undefined;
  const overdue = aging.data ? Object.values(aging.data.buckets).filter((_, i) => i > 0).reduce((n, b) => n + b.count, 0) : 0;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Reports" onBack={back} docsKey="RP1" />

      <View className="gap-6 pb-8">
        {canReports ? (
          <Section title="At a glance">
            <View className="gap-3">
              <View className="flex-row gap-3">
                <DrillFigure
                  label="Received this month"
                  value={Number(summary.data?.income.total ?? 0)}
                  tone="success"
                  caption={summary.data?.period.label}
                  onPress={range ? () => router.push(paymentsHref(range, 'Money received') as never) : undefined}
                  testID="rp1-received"
                />
                <DrillFigure
                  label="Still owed"
                  value={Number(aging.data?.summary.totalOutstanding ?? 0)}
                  tone="warning"
                  caption={aging.data ? `${aging.data.summary.totalMembers.toLocaleString('en-NG')} members` : undefined}
                  onPress={() => router.push(chargesHref({ scope: 'owing' }, 'Everything still owed') as never)}
                  testID="rp1-owed"
                />
              </View>
              <View className="flex-row gap-3">
                <DrillFigure
                  label="Overdue charges"
                  value={overdue}
                  format="count"
                  caption="Past their due date"
                  onPress={() => router.push(chargesHref({ scope: 'overdue' }, 'Overdue charges') as never)}
                  testID="rp1-overdue"
                />
              </View>
            </View>
          </Section>
        ) : null}

        {canReports ? (
          <Section title="Reports">
            <ListGroup>
              <ListItem leading={<IconCircle icon={Wallet} tone="primary" />} title="Financial summary" meta="Money received and charges, by period" showChevron onPress={() => go('financial-summary')} testID="rp-summary" />
              <ListItem leading={<IconCircle icon={Users} tone="primary" />} title="Member balances" meta="What each member has paid and still owes" showChevron onPress={() => go('member-balances')} testID="rp-balances" />
              <ListItem leading={<IconCircle icon={Clock3} tone="warning" />} title="Aging" meta="How long what is owed has been owed" showChevron onPress={() => go('aging')} testID="rp-aging" />
              <ListItem leading={<IconCircle icon={TrendingUp} tone="primary" />} title="Collection rate" meta="Of what was charged, how much was paid" showChevron onPress={() => go('collection-rate')} testID="rp-collection" />
              <ListItem leading={<IconCircle icon={FolderTree} tone="primary" />} title="By category" meta="Dues, levies, donations and penalties" showChevron onPress={() => go('by-category')} testID="rp-category" />
            </ListGroup>
          </Section>
        ) : null}

        {canExports ? (
          <Section title="Files">
            <ListGroup>
              <ListItem leading={<IconCircle icon={FileDown} tone="info" />} title="Exports" meta="Make a PDF or Excel file and share it" showChevron onPress={() => go('exports')} testID="rp-exports" />
            </ListGroup>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}

