import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { InfiniteData, UseInfiniteQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import type { PermissionAlias } from '@/lib/permissions';
import type { SavingsDepositStatus } from '@/types/api/cooperatives';
import { COOP_MODULE } from '../queries';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_OPTIONS } from '../labels';
import { ReasonSheet } from './ReasonSheet';
import { RequestCard, type ReceiptLink, type RequestLike } from './RequestCard';

/**
 * The queue of member-declared payments an officer decides (savings deposits, or loan repayments): Waiting / Approved / Not approved
 * tabs over a paged list of `RequestCard`s. Approving records the money and tells the member; rejecting needs a reason they can read.
 * An officer's own request is shown but can't be decided by them.
 */
export function RequestQueue<T extends RequestLike>({
  title,
  docsKey,
  access,
  useRequests,
  itemsOf,
  contextOf,
  loadReceipt,
  useApprove,
  useReject,
  approvedMessage,
  emptyHint,
}: {
  title: string;
  docsKey: string;
  access: PermissionAlias;
  useRequests: (status: SavingsDepositStatus) => UseInfiniteQueryResult<InfiniteData<unknown>, Error>;
  /** The requests on one page of the response (the key differs: `deposits` or `repaymentRequests`). */
  itemsOf: (page: any) => T[];
  contextOf: (request: T) => string;
  loadReceipt: (id: number) => Promise<ReceiptLink>;
  useApprove: () => UseMutationResult<unknown, Error, number>;
  useReject: () => UseMutationResult<unknown, Error, { id: number; reason: string }>;
  approvedMessage: (request: T) => string;
  emptyHint: string;
}) {
  const router = useRouter();
  const allowed = useModuleAccess(access, COOP_MODULE);
  const canDecide = useCan(access);
  const ownMemberId = useMemberId();
  const [status, setStatus] = useState<SavingsDepositStatus>('PENDING');
  const [picked, setPicked] = useState<T | null>(null);
  const confirmRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const query = useRequests(status);
  const approve = useApprove();
  const reject = useReject();
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((page) => itemsOf(page)), [query.data, itemsOf]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  const doApprove = () => {
    if (!picked) return;
    approve.mutate(picked.id, {
      onSuccess: () => {
        confirmRef.current?.dismiss();
        toast.success(approvedMessage(picked));
      },
      onError: (error) => {
        confirmRef.current?.dismiss();
        fail(error, 'Could not approve it. Try again.');
      },
    });
  };

  const doReject = (reason: string) => {
    if (!picked) return;
    reject.mutate(
      { id: picked.id, reason },
      {
        onSuccess: () => {
          rejectRef.current?.dismiss();
          toast.success('Rejected — the member has been told why');
        },
        onError: (error) => {
          rejectRef.current?.dismiss();
          fail(error, 'Could not reject it. Try again.');
        },
      },
    );
  };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={title} onBack={back} docsKey={docsKey} />

      <View className="pb-3">
        <SegmentedControl<SavingsDepositStatus>
          options={REQUEST_STATUS_OPTIONS.map((value) => ({ label: REQUEST_STATUS_LABELS[value], value }))}
          value={status}
          onChange={setStatus}
          testID="queue-status"
        />
      </View>

      <PagedList
        query={query}
        items={items}
        keyOf={(request) => String(request.id)}
        skeletonHeight={150}
        renderItem={(request) => (
          <View className="pb-3">
            <RequestCard
              request={request}
              context={contextOf(request)}
              ownMemberId={ownMemberId}
              canDecide={canDecide}
              loadReceipt={loadReceipt}
              busy={approve.isPending && picked?.id === request.id}
              onApprove={() => {
                setPicked(request);
                confirmRef.current?.present();
              }}
              onReject={() => {
                setPicked(request);
                rejectRef.current?.present();
              }}
            />
          </View>
        )}
        empty={<EmptyState icon={Inbox} title={status === 'PENDING' ? 'Nothing waiting' : 'Nothing here'} description={status === 'PENDING' ? emptyHint : 'Nothing has been decided this way yet.'} />}
      />

      <ConfirmSheet
        ref={confirmRef}
        title="Approve this payment?"
        description={picked ? `This records ${formatMoney(picked.amount)} from ${picked.memberName} and tells them. Only approve once you have confirmed the money.` : ''}
        confirmLabel="Approve"
        destructive={false}
        onConfirm={doApprove}
      />
      <ReasonSheet
        ref={rejectRef}
        title="Reject this payment?"
        description="The member is told, and sees your reason, so they can put it right."
        confirmLabel="Reject"
        loading={reject.isPending}
        onConfirm={doReject}
      />
    </Screen>
  );
}
