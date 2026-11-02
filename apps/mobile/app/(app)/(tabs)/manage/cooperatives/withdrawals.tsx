import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { Banknote } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { PayoutSheet } from '@/features/coopEnhanced/components/PayoutSheet';
import { WITHDRAWAL_STATUS_KEYS, WITHDRAWAL_STATUS_LABELS, withdrawalActions } from '@/features/coopEnhanced/labels';
import { COOP_MODULE, useDecideWithdrawal, useWithdrawalQueue } from '@/features/coopEnhanced/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_WITHDRAWAL_QUEUE_ACCESS } from '@/lib/permissions';
import { useSessionStore } from '@/stores/session';
import type { WithdrawalApprovePayload, WithdrawalDTO, WithdrawalStatus } from '@/types/api/coopEnhanced';

const TABS: { label: string; value: WithdrawalStatus }[] = [
  { label: 'To review', value: 'PENDING_REVIEW' },
  { label: 'To approve', value: 'PENDING_APPROVAL' },
  { label: 'Paid out', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

/**
 * Withdrawals: members ask to take money out; two different officers decide. Stage one (review) checks eligibility and passes it on or
 * rejects it; stage two (approve and pay) records how it was paid out. The member, the reviewer and the approver must be three different
 * people, and the balance moves only at final approval, when the balance, the loan hold and the monthly limit are checked again.
 */
export default function WithdrawalsQueueScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOPERATIVE_WITHDRAWAL_QUEUE_ACCESS, COOP_MODULE);
  const canReview = useCan('COOPERATIVE_WITHDRAWAL_REVIEW');
  const canApprove = useCan('COOPERATIVE_WITHDRAWAL_APPROVE');
  const userId = useSessionStore((s) => s.user?.id);
  const memberId = useMemberId();
  const [status, setStatus] = useState<WithdrawalStatus>(canReview || !canApprove ? 'PENDING_REVIEW' : 'PENDING_APPROVAL');
  const query = useWithdrawalQueue(status);
  const { review, approve, reject } = useDecideWithdrawal();
  const [picked, setPicked] = useState<WithdrawalDTO | null>(null);
  const forwardRef = useRef<BottomSheetModal>(null);
  const rejectReviewRef = useRef<BottomSheetModal>(null);
  const payoutRef = useRef<BottomSheetModal>(null);
  const rejectFinalRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Withdrawals" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);
  const done = (ref: React.RefObject<BottomSheetModal | null>, message: string) => {
    ref.current?.dismiss();
    toast.success(message);
  };

  const doForward = () => {
    if (!picked) return;
    review.mutate(
      { id: picked.id, body: { decision: 'FORWARD' } },
      { onSuccess: () => done(forwardRef, 'Passed on for final approval'), onError: (e) => { forwardRef.current?.dismiss(); fail(e, 'Could not pass it on. Try again.'); } },
    );
  };
  const doRejectReview = (reason: string) => {
    if (!picked) return;
    review.mutate(
      { id: picked.id, body: { decision: 'REJECT', reason } },
      { onSuccess: () => done(rejectReviewRef, 'Rejected. The member has been told why'), onError: (e) => { rejectReviewRef.current?.dismiss(); fail(e, 'Could not reject it. Try again.'); } },
    );
  };
  const doApprove = (body: WithdrawalApprovePayload) => {
    if (!picked) return;
    approve.mutate(
      { id: picked.id, body },
      { onSuccess: () => done(payoutRef, 'Withdrawal approved and recorded'), onError: (e) => { payoutRef.current?.dismiss(); fail(e, 'Could not approve it. Try again.'); } },
    );
  };
  const doRejectFinal = (reason: string) => {
    if (!picked) return;
    reject.mutate(
      { id: picked.id, reason },
      { onSuccess: () => done(rejectFinalRef, 'Rejected. The member has been told why'), onError: (e) => { rejectFinalRef.current?.dismiss(); fail(e, 'Could not reject it. Try again.'); } },
    );
  };

  const items = query.data?.requests ?? [];

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader title="Withdrawals" onBack={back} />
      <View className="gap-4 pb-8">
        <Text variant="body" tone="secondary">
          Member withdrawal requests, decided in two stages by two different officers.
        </Text>
        <SegmentedControl<WithdrawalStatus> options={TABS} value={status} onChange={setStatus} testID="wd-tabs" />

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={130} radius="lg" />
            <Skeleton width="100%" height={130} radius="lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Banknote} title="No withdrawal requests here" description="When a member asks to withdraw, it appears under To review (or To approve, if your cooperative runs one stage)." />
        ) : (
          <View className="gap-3">
            {items.map((w) => {
              const act = withdrawalActions(w, { review: canReview, approve: canApprove }, { userId, memberId });
              return (
                <Card key={w.id} testID={`wd-${w.id}`}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text variant="body-strong">{w.memberName}</Text>
                      <Text variant="caption" tone="secondary">{`${w.memberNumber} · ${w.accountTypeName}`}</Text>
                      <Text variant="caption" tone="secondary">{`Requested ${formatDate(w.createdAt, 'short')}`}</Text>
                    </View>
                    <View className="items-end gap-1.5">
                      <Money value={w.amount} size="body-strong" />
                      <StatusChip status={WITHDRAWAL_STATUS_KEYS[w.status]} label={WITHDRAWAL_STATUS_LABELS[w.status]} />
                    </View>
                  </View>
                  {w.reason ? <Text variant="caption" tone="secondary" className="mt-2">{`Reason: ${w.reason}`}</Text> : null}
                  {w.reviewedAt ? <Text variant="caption" tone="secondary">{`Reviewed ${formatDate(w.reviewedAt, 'short')}${w.reviewComment ? `: ${w.reviewComment}` : ''}`}</Text> : null}
                  {w.status === 'APPROVED' ? (
                    <Text variant="caption" tone="success">{`Paid out${w.payoutMethod ? ` by ${w.payoutMethod.replace(/_/g, ' ').toLowerCase()}` : ''}${w.payoutReference ? ` (ref ${w.payoutReference})` : ''}.`}</Text>
                  ) : null}
                  {w.status === 'REJECTED' && w.rejectionReason ? <Text variant="caption" tone="danger">{`Rejected: ${w.rejectionReason}`}</Text> : null}

                  {'review' in act && act.review ? (
                    <View className="mt-3 flex-row gap-3">
                      <Button variant="secondary" fullWidth onPress={() => { setPicked(w); rejectReviewRef.current?.present(); }} testID={`wd-reject-review-${w.id}`}>Reject</Button>
                      <Button variant="primary" fullWidth onPress={() => { setPicked(w); forwardRef.current?.present(); }} testID={`wd-forward-${w.id}`}>Pass on</Button>
                    </View>
                  ) : null}
                  {'approve' in act && act.approve ? (
                    <View className="mt-3 flex-row gap-3">
                      <Button variant="secondary" fullWidth onPress={() => { setPicked(w); rejectFinalRef.current?.present(); }} testID={`wd-reject-final-${w.id}`}>Reject</Button>
                      <Button variant="primary" fullWidth onPress={() => { setPicked(w); payoutRef.current?.present(); }} testID={`wd-approve-${w.id}`}>Approve and pay</Button>
                    </View>
                  ) : null}
                  {'note' in act && act.note ? <Text variant="caption" tone="secondary" className="mt-3">{act.note}</Text> : null}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <ConfirmSheet
        ref={forwardRef}
        title="Pass this on for approval?"
        description={picked ? `${picked.memberName}'s request to withdraw ${picked.amount} is checked once more, then goes to a different officer for final approval.` : ''}
        confirmLabel="Pass on"
        destructive={false}
        onConfirm={doForward}
      />
      <ReasonSheet ref={rejectReviewRef} title="Reject this withdrawal?" description="The member is told, and sees your reason, so they can put it right." confirmLabel="Reject" loading={review.isPending} onConfirm={doRejectReview} />
      <PayoutSheet ref={payoutRef} summary={picked ? `${picked.memberName} · ${picked.accountTypeName} · ${picked.amount}` : ''} loading={approve.isPending} onConfirm={doApprove} />
      <ReasonSheet ref={rejectFinalRef} title="Reject this withdrawal?" description="The member is told, and sees your reason, so they can put it right." confirmLabel="Reject" loading={reject.isPending} onConfirm={doRejectFinal} />
    </Screen>
  );
}
