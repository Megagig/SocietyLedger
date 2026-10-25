import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ListChecks } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { ChargeRow } from '@/features/reports/components/Drill';
import { chargeHref, ledgerHref, parseChargeParams } from '@/features/reports/drill';
import { useChargeList, useReportsAccess } from '@/features/reports/queries';
import type { ChargeRowDTO } from '@/types/api/reports';

/**
 * The charges behind a figure on a report (RP2–RP6). The totals at the top are over the whole list and equal the figure that was
 * tapped; each row opens that charge.
 */
export default function ChargesDrillScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<Record<string, string>>();
  const params = useMemo(() => parseChargeParams(raw), [raw]);
  const title = (Array.isArray(raw.title) ? raw.title[0] : raw.title) || 'Charges';
  const allowed = useReportsAccess();
  const query = useChargeList(params);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.charges) ?? [], [query.data]);
  const totals = query.data?.pages[0]?.totals;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title={title}
        onBack={back}
        docsKey="RP1"
        rightActions={params.memberId ? <IconButton icon={BookOpen} accessibilityLabel="Open this member’s ledger" onPress={() => router.push(ledgerHref(params.memberId as number) as never)} testID="drill-ledger" /> : undefined}
      />
      <PagedList
        query={query}
        items={items}
        keyOf={(c) => String(c.id)}
        skeletonHeight={84}
        header={
          totals ? (
            <View className="mb-3 gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="drill-totals">
              <Text variant="caption" tone="secondary">
                {`${totals.count.toLocaleString('en-NG')} ${totals.count === 1 ? 'charge' : 'charges'}`}
              </Text>
              <View className="flex-row justify-between gap-3">
                <View className="gap-0.5">
                  <Text variant="caption" tone="secondary">
                    Charged
                  </Text>
                  <Money value={totals.amount} size="body-strong" />
                </View>
                <View className="gap-0.5">
                  <Text variant="caption" tone="secondary">
                    Paid
                  </Text>
                  <Money value={totals.paid} size="body-strong" tone="success" />
                </View>
                <View className="gap-0.5">
                  <Text variant="caption" tone="secondary">
                    Still owed
                  </Text>
                  <Money value={totals.balance} size="body-strong" tone={Number(totals.balance) > 0 ? 'warning' : 'default'} />
                </View>
              </View>
            </View>
          ) : undefined
        }
        renderItem={(c: ChargeRowDTO, i, n) => <ChargeRow item={c} position={positionOf(i, n)} onPress={(item) => router.push(chargeHref(item.id) as never)} />}
        empty={<EmptyState icon={ListChecks} title="Nothing here" description="No charges match this figure." />}
      />
    </Screen>
  );
}
