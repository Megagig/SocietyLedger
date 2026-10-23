import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { lateFeeOutcomeSummary, lateFeePreviewHeadline } from '@/features/donationsPenalties/labels';
import { useApplyLateFees } from '@/features/donationsPenalties/mutations';
import { PENALTY_APPROVE_ACCESS, useLateFeePreview } from '@/features/donationsPenalties/queries';
import { useCan } from '@/hooks/useCan';

/**
 * project-overview.md §6.9 FN11 — "Apply late fees now", after seeing exactly who would be charged. Nothing is charged until the officer
 * confirms; voided charges, donation pledges and charges still inside their grace period are left out.
 */
export default function LateFeesScreen() {
  const router = useRouter();
  const canApprove = useCan(PENALTY_APPROVE_ACCESS);
  const preview = useLateFeePreview();
  const apply = useApplyLateFees();
  const back = () => router.back();

  if (!canApprove) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Apply late fees" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const data = preview.data;

  const confirm = () =>
    apply.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(lateFeeOutcomeSummary(result));
        router.back();
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not apply the late fees. Try again.'),
    });

  return (
    <Screen edges={['top', 'bottom']} refreshing={preview.isRefetching} onRefresh={() => preview.refetch()}>
      <ScreenHeader title="Apply late fees" onBack={back} docsKey="FN11" />

      {preview.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : preview.isError || !data ? (
        <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-1 rounded-lg bg-surface-sunken p-4" testID="late-fees-headline">
            <Text variant="label">{lateFeePreviewHeadline(data)}</Text>
            <Text variant="caption" tone="secondary">
              Nothing is charged until you confirm. Voided charges, donation pledges and charges still inside their grace period are left out.
            </Text>
          </View>

          {data.items.length > 0 ? (
            <Section title="Who would be charged">
              <ListGroup>
                {data.items.map((item) => (
                  <ListItem
                    key={item.transactionId}
                    title={item.memberName}
                    meta={`${item.chargeName} · ${item.daysOverdue} ${item.daysOverdue === 1 ? 'day' : 'days'} overdue · ${item.ruleName}`}
                    trailing={<Money value={item.penaltyAmount} size="body-strong" />}
                  />
                ))}
              </ListGroup>
              {data.truncated ? (
                <Text variant="caption" tone="secondary">
                  …and more. The total above covers all of them.
                </Text>
              ) : null}
            </Section>
          ) : null}
        </View>
      )}

      {data && data.count > 0 ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth loading={apply.isPending} onPress={confirm} testID="late-fees-apply">
              {`Charge ${data.count} late ${data.count === 1 ? 'fee' : 'fees'}`}
            </Button>
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
