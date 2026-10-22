import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { approvalDisplayName, ApprovalRow } from '@/features/members/components/ApprovalRow';
import { RejectRegistrationSheet } from '@/features/members/components/RejectRegistrationSheet';
import { useDecideApproval } from '@/features/members/mutations';
import { MEMBERS_APPROVE_ACCESS, useApprovals } from '@/features/members/queries';
import { useCan } from '@/hooks/useCan';
import type { ApprovalDTO, ApprovalStatus } from '@/types/api/membersManage';

const EMPTY_COPY: Record<ApprovalStatus, { title: string; description: string }> = {
  pending: { title: 'No one is waiting', description: 'When someone registers themselves, they show up here for you to approve.' },
  approved: { title: 'No approved registrations', description: 'People you approve show up here.' },
  rejected: { title: 'No rejected registrations', description: 'People you reject show up here, with your reason.' },
};

/** project-overview.md §6.9 MG5 — self-registered people waiting for an officer. Approving lets them sign in at once. */
export default function MemberApprovalsScreen() {
  const router = useRouter();
  const canApprove = useCan(MEMBERS_APPROVE_ACCESS);
  const [status, setStatus] = useState<ApprovalStatus>('pending');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<ApprovalDTO | null>(null);
  const approveSheetRef = useRef<BottomSheetModal>(null);
  const rejectSheetRef = useRef<BottomSheetModal>(null);

  const term = search.trim();
  const query = useApprovals(status, term);
  const decide = useDecideApproval();
  const approvals = useMemo(() => query.data?.pages.flatMap((page) => page.approvals) ?? [], [query.data]);
  const back = () => router.back();

  if (!canApprove) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Pending approvals" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const finish = (approved: boolean, result: { emailSent: boolean }) => {
    toast.success(approved ? 'Member approved' : 'Registration rejected');
    // The decision is saved even when the email isn't — say so, so the officer can tell the person another way.
    if (!result.emailSent) toast.warning("The decision was saved, but we couldn't email them. Let them know yourself.");
  };
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save your decision. Try again.');

  const approve = () => {
    if (!target) return;
    decide.mutate(
      { userId: target.userId, status: 'approved' },
      {
        onSuccess: (result) => {
          approveSheetRef.current?.dismiss();
          finish(true, result);
        },
        onError: fail,
      },
    );
  };

  const reject = (rejectionReason: string | undefined) => {
    if (!target) return;
    decide.mutate(
      { userId: target.userId, status: 'rejected', rejectionReason },
      {
        onSuccess: (result) => {
          rejectSheetRef.current?.dismiss();
          finish(false, result);
        },
        onError: fail,
      },
    );
  };

  const empty = EMPTY_COPY[status];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Pending approvals" onBack={back} docsKey="MG5" />

      <View className="gap-3 pb-3">
        <SegmentedControl<ApprovalStatus>
          options={[
            { label: 'Pending', value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ]}
          value={status}
          onChange={setStatus}
          testID="approvals-status"
        />
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or email" />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={120} radius="lg" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={approvals}
          keyExtractor={(approval) => String(approval.id)}
          renderItem={({ item }) => (
            <View className="pb-3">
              <ApprovalRow
                approval={item}
                busy={decide.isPending}
                onApprove={
                  status === 'pending'
                    ? (approval) => {
                        setTarget(approval);
                        approveSheetRef.current?.present();
                      }
                    : undefined
                }
                onReject={
                  status === 'pending'
                    ? (approval) => {
                        setTarget(approval);
                        rejectSheetRef.current?.present();
                      }
                    : undefined
                }
              />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon={UserCheck} title={term ? 'No registrations match' : empty.title} description={term ? 'Try a different name or email.' : empty.description} />}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ConfirmSheet
        ref={approveSheetRef}
        title={target ? `Approve ${approvalDisplayName(target)}?` : 'Approve this member?'}
        description="They will be able to sign in straight away, and they get an email to say so."
        confirmLabel="Approve member"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={approve}
        onDismiss={() => setTarget(null)}
      />
      <RejectRegistrationSheet
        ref={rejectSheetRef}
        name={target ? approvalDisplayName(target) : 'This person'}
        loading={decide.isPending}
        onSubmit={reject}
        onDismiss={() => setTarget(null)}
      />
    </Screen>
  );
}
