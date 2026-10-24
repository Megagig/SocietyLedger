import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
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
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import {
  APPLICATION_STATUS_LABELS,
  applicationCanDisburse,
  applicationCanReview,
  applicationStatusKey,
  GUARANTOR_STATUS_LABELS,
  guarantorSummary,
  INTEREST_TYPE_LABELS,
  isOwnRequest,
} from '@/features/coopManage/labels';
import { useReviewApplication } from '@/features/coopManage/mutations';
import { COOP_LOANS_ACCESS, COOP_MODULE, useApplication } from '@/features/coopManage/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/**
 * project-overview.md §6.9 CP4 — one loan application: who, how much, the terms the server worked out, the guarantors, and Approve /
 * Reject (reason) while it is waiting, then Disburse once approved. An officer's own application can't be decided by them.
 */
export default function ApplicationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const ownMemberId = useMemberId();
  const query = useApplication(id);
  const review = useReviewApplication(id);
  const approveRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan application" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const application = query.data;
  const own = !!application && isOwnRequest(application.memberId, ownMemberId);
  const canReview = !!application && applicationCanReview(application.status);
  const canDisburse = !!application && applicationCanDisburse(application.status);

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save your decision. Try again.');

  const approve = () =>
    review.mutate(
      { action: 'approve' },
      {
        onSuccess: () => {
          approveRef.current?.dismiss();
          toast.success('Application approved — it can now be paid out');
        },
        onError: (error) => {
          approveRef.current?.dismiss();
          fail(error);
          void query.refetch();
        },
      },
    );

  const reject = (reason: string) =>
    review.mutate(
      { action: 'reject', rejectionReason: reason },
      {
        onSuccess: () => {
          rejectRef.current?.dismiss();
          toast.success('Application rejected — the member has been told why');
        },
        onError: (error) => {
          rejectRef.current?.dismiss();
          fail(error);
          void query.refetch();
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Loan application" onBack={back} docsKey="CP4" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={220} radius="md" />
        </View>
      ) : query.isError || !application ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {`${application.memberName} · ${application.loanProductName}`}
            </Text>
            <Money value={application.amount} size="h1" />
            <StatusChip status={applicationStatusKey(application.status)} label={APPLICATION_STATUS_LABELS[application.status]} />
          </View>

          {application.status === 'REJECTED' && application.rejectionReason ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4">
              <Text variant="label" tone="danger">
                Rejected
              </Text>
              <Text variant="body">{application.rejectionReason}</Text>
            </View>
          ) : null}

          <Section title="Purpose">
            <Text variant="body">{application.purpose}</Text>
          </Section>

          <Section title="The loan">
            <ListGroup>
              <FactRow label="Application" value={application.applicationNumber} />
              <FactRow label="Tenure" value={`${application.tenureMonths} months`} />
              <FactRow label="Interest" value={`${Number(application.interestRate)}% ${INTEREST_TYPE_LABELS[application.interestType].toLowerCase()}`} />
              <FactRow label="Monthly repayment" amount={application.monthlyRepayment} />
              <FactRow label="Total interest" amount={application.totalInterest} />
              <FactRow label="Total to repay" amount={application.totalRepayment} />
              <FactRow label="Processing fee" amount={application.processingFee} />
              <FactRow label="Applied" value={formatDate(application.appliedAt, 'long')} />
              <FactRow label="Collateral" value={application.collateralDescription} />
            </ListGroup>
          </Section>

          <Section title={`Guarantors · ${guarantorSummary(application.guarantors, 0)}`}>
            {application.guarantors.length === 0 ? (
              <Text variant="body" tone="secondary">
                No guarantors were asked.
              </Text>
            ) : (
              <ListGroup>
                {application.guarantors.map((g) => (
                  <ListItem
                    key={g.id}
                    title={g.guarantorName}
                    meta={`${formatMoney(g.guaranteeAmount)} · ${GUARANTOR_STATUS_LABELS[g.status]}${g.declineReason ? ` — ${g.declineReason}` : ''}`}
                    trailing={<StatusChip status={g.status === 'ACCEPTED' ? 'accepted' : g.status === 'DECLINED' ? 'declined' : 'pending'} label={GUARANTOR_STATUS_LABELS[g.status]} />}
                  />
                ))}
              </ListGroup>
            )}
          </Section>

          {canReview && own ? (
            <Text variant="caption" tone="secondary" testID="application-own">
              This is your own application, so another officer needs to decide it.
            </Text>
          ) : null}
        </View>
      )}

      {application && canReview && !own ? (
        <StickyFooter>
          <View className="flex-1 flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => rejectRef.current?.present()} testID="application-reject">
                Reject
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" fullWidth onPress={() => approveRef.current?.present()} testID="application-approve">
                Approve
              </Button>
            </View>
          </View>
        </StickyFooter>
      ) : null}

      {application && canDisburse && !own ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => router.push(`/(app)/(tabs)/manage/cooperatives/applications/disburse?id=${id}` as never)} testID="application-disburse">
              Pay out this loan
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={approveRef}
        title="Approve this loan?"
        description={application ? `${application.memberName} is approved for ${formatMoney(application.amount)}. It is not paid out until you do that as a separate step.` : ''}
        confirmLabel="Approve loan"
        destructive={false}
        onConfirm={approve}
      />
      <ReasonSheet
        ref={rejectRef}
        title="Reject this application?"
        description="The member is told, and sees your reason."
        confirmLabel="Reject application"
        loading={review.isPending}
        onConfirm={reject}
      />
    </Screen>
  );
}
