import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { welfareManageApi } from '@/api/endpoints/welfareManage';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { AmountField } from '@/components/forms/AmountField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { isOwnRequest } from '@/features/coopManage/labels';
import { approvalLimitReason, maxApproval, payoutCanReview, reviewedSummary } from '@/features/welfareManage/labels';
import { useReviewPayout } from '@/features/welfareManage/mutations';
import { usePayoutById, WELFARE_MODULE, WELFARE_PAYOUT_ACCESS } from '@/features/welfareManage/queries';
import { buildApproveSchema, type ApproveValues } from '@/features/welfareManage/schemas';
import { parseAmount } from '@/features/finance/schemas';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 WF4 — approve a payout request for an amount. It can be less than was asked, never more than was asked, the
 * fund's payout limit or what the fund holds. Approving does not pay it out; that is the next step.
 */
export default function ApprovePayoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(WELFARE_PAYOUT_ACCESS, WELFARE_MODULE);
  const ownMemberId = useMemberId();
  const tenant = useTenantKey();
  const lookup = usePayoutById(id);
  const request = lookup.request;
  // The fund's balance and limit are read fresh, because they can change between the queue and this screen.
  const fund = useQuery({
    queryKey: [tenant, 'welfare', 'admin', 'fund-for-payout', request?.fundId],
    queryFn: async () => (await welfareManageApi.listFunds({ limit: 100 })).funds.find((f) => f.id === request?.fundId),
    enabled: allowed && request !== undefined,
    staleTime: 0,
  });
  const review = useReviewPayout(id);
  const max = request && fund.data ? maxApproval({ requested: request.amount, maxPayout: fund.data.maxPayout, balance: fund.data.currentBalance }) : 0;
  const schema = useMemo(() => buildApproveSchema(max), [max]);
  const { control, handleSubmit } = useForm<ApproveValues>({
    resolver: zodResolver(schema),
    values: { amount: max > 0 ? String(max) : '', comments: '' },
    mode: 'onTouched',
  });
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Approve the request" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (lookup.isPending || (request && fund.isPending)) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Approve the request" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (!request || lookup.isError || fund.isError || !fund.data) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Approve the request" onBack={back} />
        <ErrorState error={lookup.error ?? fund.error} onRetry={() => { void lookup.refetch(); void fund.refetch(); }} />
      </Screen>
    );
  }

  if (!payoutCanReview(request.status) || isOwnRequest(request.memberId, ownMemberId)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Approve the request" onBack={back} />
        <ErrorState
          title={isOwnRequest(request.memberId, ownMemberId) ? 'This is your own request.' : 'This request has already been decided.'}
          description={isOwnRequest(request.memberId, ownMemberId) ? 'Another officer needs to decide it.' : 'Go back to see where it stands.'}
        />
      </Screen>
    );
  }

  if (max <= 0) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Approve the request" onBack={back} />
        <ErrorState title="The fund can't pay this out." description={`${fund.data.name} holds ${formatMoney(fund.data.currentBalance)}, so nothing can be approved. Reject the request, or wait until it holds more.`} />
      </Screen>
    );
  }

  const submit = (values: ApproveValues) =>
    review.mutate(
      { status: 'APPROVED', approvedAmount: parseAmount(values.amount) ?? 0, comments: values.comments.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(reviewedSummary(true, values.amount.replace(/,/g, '')));
          router.back();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Could not approve it. Try again.');
          void lookup.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Approve the request" onBack={back} docsKey="WF4" />

      <View className="gap-6 pb-6">
        <View className="items-center gap-1 pt-1">
          <Text variant="body" tone="secondary">
            {`${request.member.firstName} ${request.member.lastName} · ${fund.data.name}`}
          </Text>
          <Money value={request.amount} size="h1" />
          <Text variant="caption" tone="secondary">
            asked for
          </Text>
        </View>

        <Section title="What to approve">
          <View className="gap-4">
            <AmountField
              control={control}
              name="amount"
              label="Amount to approve"
              helper={max < Number(request.amount) ? `At most ${formatMoney(max)}: ${approvalLimitReason({ requested: request.amount, maxPayout: fund.data.maxPayout, balance: fund.data.currentBalance })}.` : `Up to ${formatMoney(max)}. You can approve less than was asked.`}
            />
            <TextField control={control} name="comments" label="Comment (optional)" multiline />
          </View>
        </Section>

        <Text variant="caption" tone="secondary">
          Approving does not pay anything out yet. The money leaves the fund when you pay it out as a separate step.
        </Text>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={review.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="approve-save">
            Approve request
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
