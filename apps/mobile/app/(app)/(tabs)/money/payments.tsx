import { View, FlatList } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { router } from 'expo-router';

import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useMemberPayments } from '@/features/memberFinance/queries';
import { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { formatDate } from '@/lib/dates';

type Payment = Awaited<ReturnType<typeof memberFinanceApi.getPayments>>[number];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_money: 'Mobile money',
  cheque: 'Cheque',
  other: 'Other',
};

export default function PaymentsScreen() {
  const paymentsQuery = useMemberPayments();
  const payments = paymentsQuery.data ?? [];

  return (
    <Screen edges={['top']} scroll={false} refreshing={paymentsQuery.isRefetching} onRefresh={() => paymentsQuery.refetch()}>
      <ScreenHeader title="Payment History" onBack={() => router.back()} />

      {paymentsQuery.isPending ? (
        <View className="gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={56} radius="md" />
          ))}
        </View>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Your payment history will appear here once you make payments."
        />
      ) : (
        <FlatList<Payment>
          data={payments}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={() => <Divider />}
          getItemLayout={(_data, index) => ({ length: 72, offset: 72 * index, index })}
          renderItem={({ item: payment }) => (
            <View className="flex-row items-center px-4 py-3 min-h-[56px]">
              <View className="flex-1">
                <Text variant="body-lg" numberOfLines={1}>
                  {payment.transaction.category.name}
                </Text>
                <View className="flex-row items-center gap-2 mt-0.5">
                  <Text variant="caption" tone="secondary">
                    {formatDate(payment.paymentDate, 'short')}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}
                  </Text>
                </View>
              </View>
              <View className="ml-3 items-end gap-1">
                <Money value={payment.amount} size="body-strong" />
                <StatusChip status="paid" />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
