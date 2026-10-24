import { useLocalSearchParams, useRouter } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { PaymentRow } from '@/features/reports/components/Drill';
import { chargeHref, parsePaymentParams } from '@/features/reports/drill';
import { usePaymentList, useReportsAccess } from '@/features/reports/queries';
import type { PaymentRowDTO } from '@/types/api/reports';

/**
 * The payments that make up "money received" (RP2). The total at the top is over the whole list and equals the figure that was
 * tapped; each row opens the charge it paid.
 */
export default function PaymentsDrillScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<Record<string, string>>();
  const params = useMemo(() => parsePaymentParams(raw), [raw]);
  const title = (Array.isArray(raw.title) ? raw.title[0] : raw.title) || 'Payments';
  const allowed = useReportsAccess();
  const query = usePaymentList(params);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.payments) ?? [], [query.data]);
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
      <ScreenHeader title={title} onBack={back} docsKey="RP2" />
      <PagedList
        query={query}
        items={items}
        keyOf={(p) => String(p.id)}
        skeletonHeight={72}
        header={
          totals ? (
            <View className="mb-3 flex-row items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="drill-totals">
              <View className="gap-0.5">
                <Text variant="caption" tone="secondary">
                  {`${totals.count.toLocaleString('en-NG')} ${totals.count === 1 ? 'payment' : 'payments'}`}
                </Text>
                <Text variant="caption" tone="tertiary">
                  Money received
                </Text>
              </View>
              <Money value={totals.amount} size="h3" tone="success" />
            </View>
          ) : undefined
        }
        renderItem={(p: PaymentRowDTO, i, n) => <PaymentRow item={p} position={positionOf(i, n)} onPress={(item) => router.push(chargeHref(item.chargeId) as never)} />}
        empty={<EmptyState icon={Coins} title="Nothing here" description="No payments match this figure." />}
      />
    </Screen>
  );
}
