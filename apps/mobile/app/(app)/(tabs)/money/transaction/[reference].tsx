import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { memberFinanceKeys, useVerifyPaystackPayment } from '@/features/memberFinance/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantKey } from '@/hooks/useTenantKey';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';

export default function PaymentResultScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const { color } = useThemeTokens();
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  const verifyQuery = useVerifyPaystackPayment(reference ?? '');

  function handleDone() {
    // Invalidate finance data so balances reflect the payment
    queryClient.invalidateQueries({ queryKey: memberFinanceKeys.summary(tenant) });
    queryClient.invalidateQueries({ queryKey: memberFinanceKeys.levies(tenant) });
    queryClient.invalidateQueries({ queryKey: memberFinanceKeys.outstanding(tenant) });
    router.replace('/(app)/(tabs)/money');
  }

  if (!reference) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Payment" onBack={() => router.back()} />
        <View className="items-center py-12 px-6 gap-4">
          <AlertCircle size={48} color={color.danger} strokeWidth={1.5} />
          <Text variant="h3" className="text-center">Missing reference</Text>
          <Text variant="body" tone="secondary" className="text-center">
            No payment reference was found. Please check your payment history.
          </Text>
          <Button variant="gradient" size="lg" fullWidth onPress={handleDone}>Go to finances</Button>
        </View>
      </Screen>
    );
  }

  // Loading
  if (verifyQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Verifying payment…" onBack={() => router.back()} />
        <View className="items-center py-12 px-6 gap-4">
          <Skeleton width={80} height={80} radius="full" />
          <Skeleton width={200} height={24} radius="md" />
          <Skeleton width={160} height={16} radius="md" />
          <View className="w-full gap-2 mt-4">
            <Skeleton width="100%" height={56} radius="md" />
            <Skeleton width="100%" height={56} radius="md" />
            <Skeleton width="100%" height={56} radius="md" />
          </View>
        </View>
      </Screen>
    );
  }

  const data = verifyQuery.data;
  const isSuccess = !verifyQuery.isError && data?.status === 'success';

  // Success
  if (isSuccess && data) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Payment successful" onBack={handleDone} />

        {/* Hero */}
        <View className="items-center py-8 gap-3">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: `${color.success}22` }}
          >
            <CheckCircle2 size={48} color={color.success} strokeWidth={1.5} />
          </View>
          <Text variant="h2" className="text-center">Payment successful</Text>
          <Text variant="body" tone="secondary" className="text-center px-8">
            Your payment has been processed and your balance updated.
          </Text>
        </View>

        {/* Payment details — web parity */}
        <Section title="Payment details">
          <ListGroup>
            <ListItem
              title="Amount paid"
              trailing={
                <Money value={toDecimal(data.amount)} size="body-strong" tone="default" />
              }
            />
            {data.receiptNumber && (
              <ListItem
                title="Receipt number"
                trailing={<Text variant="body-strong">{data.receiptNumber}</Text>}
              />
            )}
            <ListItem
              title="Reference"
              trailing={
                <Text variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                  {data.reference}
                </Text>
              }
            />
            {data.transactionStatus && (
              <ListItem
                title="Transaction status"
                trailing={<StatusChip status={data.transactionStatus} />}
              />
            )}
            {data.paidAt && (
              <ListItem
                title="Payment date"
                trailing={
                  <Text variant="body">{formatDate(data.paidAt, 'long')}</Text>
                }
              />
            )}
          </ListGroup>
        </Section>

        <View className="px-4 gap-3 mt-4">
          <Button variant="gradient" size="lg" fullWidth onPress={handleDone}>Done</Button>
          <Button variant="secondary" size="lg" fullWidth onPress={() => router.push('/(app)/(tabs)/money/ledger' as never)}>
            View ledger
          </Button>
        </View>
      </Screen>
    );
  }

  // Failure
  const errorMessage = verifyQuery.isError
    ? (verifyQuery.error as any)?.message ?? 'Verification failed'
    : data?.gatewayResponse ?? 'Your payment could not be confirmed';

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Payment failed" onBack={() => router.back()} />

      {/* Hero */}
      <View className="items-center py-8 gap-3">
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color.danger}22` }}
        >
          <XCircle size={48} color={color.danger} strokeWidth={1.5} />
        </View>
        <Text variant="h2" className="text-center">Payment failed</Text>
        <Text variant="body" tone="secondary" className="text-center px-8">
          {errorMessage}
        </Text>
      </View>

      {/* Reference for support */}
      <Section title="Details">
        <ListGroup>
          <ListItem
            title="Reference"
            trailing={
              <Text variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                {reference}
              </Text>
            }
          />
          {data?.gatewayResponse && (
            <ListItem
              title="Gateway response"
              trailing={<Text variant="caption" tone="secondary">{data.gatewayResponse}</Text>}
            />
          )}
        </ListGroup>
      </Section>

      <View className="px-4 gap-3 mt-4">
        <Button
          variant="gradient"
          size="lg"
          fullWidth
          onPress={() => verifyQuery.refetch()}
        >
          Try again
        </Button>
        <Button variant="ghost" size="lg" fullWidth onPress={handleDone}>
          Back to finances
        </Button>
      </View>
    </Screen>
  );
}
