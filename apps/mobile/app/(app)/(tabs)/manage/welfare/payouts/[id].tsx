import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { isOwnRequest } from '@/features/coopManage/labels';
import { PAYOUT_TYPE_LABELS } from '@/features/welfare/labels';
import { FactRow } from '@/features/members/components/FactRow';
import { useMemberWelfare } from '@/features/members/queries';
import { FUND_KIND_LABELS, PAYOUT_STATUS_LABELS, payoutCanDisburse, payoutCanReview, payoutStatusKey, reviewedSummary } from '@/features/welfareManage/labels';
import { useReviewPayout } from '@/features/welfareManage/mutations';
import { usePayoutById, WELFARE_MODULE, WELFARE_PAYOUT_ACCESS } from '@/features/welfareManage/queries';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 WF4 — one payout request: who asked, what for, how much, how much they have put in, and Approve (with an
 * amount) / Reject (with a reason) while it is waiting, then Pay out once approved. An officer's own request can't be decided by them.
 */
export default function PayoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(WELFARE_PAYOUT_ACCESS, WELFARE_MODULE);
  const ownMemberId = useMemberId();
  // The queue already holds every request in full; the detail reads it from there so a decision elsewhere shows up on refresh.
  const list = usePayoutById(id);
  const request = list.request;
  const standing = useMemberWelfare(request?.memberId ?? NaN, request !== undefined);
  const review = useReviewPayout(id);
  const rejectRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/welfare/payouts/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payout request" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const own = !!request && isOwnRequest(request.memberId, ownMemberId);
  const canReview = !!request && payoutCanReview(request.status);
  const canDisburse = !!request && payoutCanDisburse(request.status);

  const reject = (reason: string) =>
    review.mutate(
      { status: 'REJECTED', rejectionReason: reason },
      {
        onSuccess: () => {
          rejectRef.current?.dismiss();
          toast.success(reviewedSummary(false, 0));
          back();
        },
        onError: (error) => {
          rejectRef.current?.dismiss();
          toast.error(error instanceof ApiError ? error.message : 'Could not save your decision. Try again.');
          void list.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <ScreenHeader title="Payout request" onBack={back} docsKey="WF4" />

      {list.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={220} radius="md" />
        </View>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !request ? (
        <ErrorState title="We couldn't find that request." description="It may be on a later page of the list. Go back and open it from there." />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {`${request.member.firstName} ${request.member.lastName} · ${request.fund.name}`}
            </Text>
            <Money value={request.status === 'APPROVED' || request.status === 'DISBURSED' ? (request.approvedAmount ?? request.amount) : request.amount} size="h1" />
            <StatusChip status={payoutStatusKey(request.status)} label={PAYOUT_STATUS_LABELS[request.status]} />
            {request.approvedAmount !== null && Number(request.approvedAmount) !== Number(request.amount) ? (
              <Text variant="caption" tone="secondary">{`${formatMoney(request.amount)} was asked for`}</Text>
            ) : null}
          </View>

          {request.status === 'REJECTED' && request.rejectionReason ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4">
              <Text variant="label" tone="danger">
                Rejected
              </Text>
              <Text variant="body">{request.rejectionReason}</Text>
            </View>
          ) : null}

          <Section title="Why they asked">
            <Text variant="body">{request.reason}</Text>
            {request.supportingDocuments ? (
              <Text variant="caption" tone="secondary">{`Supporting details: ${request.supportingDocuments}`}</Text>
            ) : null}
          </Section>

          <Section title="The request">
            <ListGroup>
              <FactRow label="Request" value={request.requestNumber} />
              <FactRow label="Kind" value={PAYOUT_TYPE_LABELS[request.payoutType] ?? request.payoutType} />
              <FactRow label="Fund" value={`${request.fund.name} · ${FUND_KIND_LABELS[request.fund.fundType]}`} />
              <FactRow label="Asked" value={formatDate(request.requestedAt, 'long')} />
              <FactRow label="Reviewed by" value={request.reviewer?.email ?? null} />
              <FactRow label="Paid out" value={request.disbursedAt ? `${formatDate(request.disbursedAt, 'long')}${request.disburser ? ` · ${request.disburser.email}` : ''}` : null} />
              <FactRow label="How" value={request.disbursementMethod ? request.disbursementMethod.replace(/_/g, ' ') : null} />
              <FactRow label="Reference" value={request.disbursementReference} />
              <FactRow label="Comments" value={request.reviewComments} />
            </ListGroup>
          </Section>

          <Section title="Their standing">
            {standing.isPending ? (
              <Skeleton width="100%" height={80} radius="md" />
            ) : standing.data ? (
              <ListGroup>
                <FactRow label="Contributed" amount={standing.data.totalContributions} />
                <FactRow label="Contributions made" value={String(standing.data.contributionCount)} />
                <FactRow label="Received before" amount={standing.data.totalPayoutsReceived} />
                <FactRow label="Open requests" value={String(standing.data.pendingRequests)} />
              </ListGroup>
            ) : (
              <Text variant="body" tone="secondary">
                Their welfare standing isn&apos;t available.
              </Text>
            )}
          </Section>

          {(canReview || canDisburse) && own ? (
            <Text variant="caption" tone="secondary" testID="payout-own">
              This is your own request, so another officer needs to decide it.
            </Text>
          ) : null}
        </View>
      )}

      {request && canReview && !own ? (
        <StickyFooter>
          <View className="flex-1 flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => rejectRef.current?.present()} testID="payout-reject">
                Reject
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" fullWidth onPress={() => go(`review?id=${id}`)} testID="payout-approve">
                Approve
              </Button>
            </View>
          </View>
        </StickyFooter>
      ) : null}

      {request && canDisburse && !own ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => go(`disburse?id=${id}`)} testID="payout-disburse">
              Pay out
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ReasonSheet ref={rejectRef} title="Reject this request?" description="The member is told, and sees your reason." confirmLabel="Reject request" loading={review.isPending} onConfirm={reject} />
    </Screen>
  );
}
