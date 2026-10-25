import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { Inbox, Plus } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { ContributionCard } from '@/features/welfareManage/components/Rows';
import { CONTRIBUTION_FILTERS, confirmGuard } from '@/features/welfareManage/labels';
import { useConfirmContribution } from '@/features/welfareManage/mutations';
import { useAdminContributions, WELFARE_CONFIRM_ACCESS, WELFARE_MANAGE_ACCESS, WELFARE_MODULE } from '@/features/welfareManage/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';
import { useSessionStore } from '@/stores/session';
import type { ContributionStatus, OfficerContributionDTO } from '@/types/api/welfareManage';

/** project-overview.md §6.9 WF3 — what members paid into the funds: the ones waiting to be confirmed first, and a way to record new ones. */
export default function ContributionsScreen() {
  const router = useRouter();
  const allowed = useModuleAccess([WELFARE_CONFIRM_ACCESS, WELFARE_MANAGE_ACCESS], WELFARE_MODULE);
  const canConfirm = useCan(WELFARE_CONFIRM_ACCESS);
  const canRecord = useCan(WELFARE_MANAGE_ACCESS);
  const ownMemberId = useMemberId();
  const ownUserId = useSessionStore((s) => s.user?.id);
  const [status, setStatus] = useState<ContributionStatus | ''>('PENDING');
  const [picked, setPicked] = useState<OfficerContributionDTO | null>(null);
  const confirmRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const query = useAdminContributions({ status: status || undefined });
  const decide = useConfirmContribution();
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.contributions) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Contributions" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  const confirm = () => {
    if (!picked) return;
    decide.mutate(
      { id: picked.id, status: 'CONFIRMED' },
      {
        onSuccess: () => {
          confirmRef.current?.dismiss();
          toast.success(`Added ${formatMoney(picked.amount)} to ${picked.fund.name}`);
        },
        onError: (error) => {
          confirmRef.current?.dismiss();
          fail(error, 'Could not confirm it. Try again.');
        },
      },
    );
  };

  const reject = (reason: string) => {
    if (!picked) return;
    decide.mutate(
      { id: picked.id, status: 'REJECTED', notes: reason },
      {
        onSuccess: () => {
          rejectRef.current?.dismiss();
          toast.success('Not approved — nothing was added to the fund');
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
      <ScreenHeader
        title="Contributions"
        onBack={back}
        docsKey="WF3"
        rightActions={canRecord ? <IconButton icon={Plus} accessibilityLabel="Record contributions" onPress={() => router.push('/(app)/(tabs)/manage/welfare/contributions/record' as never)} testID="contributions-new" /> : undefined}
      />

      <View className="pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CONTRIBUTION_FILTERS.map((f) => (
            <FilterChip key={f.label} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
          ))}
        </ScrollView>
      </View>

      <PagedList
        query={query}
        items={items}
        keyOf={(c) => String(c.id)}
        skeletonHeight={130}
        renderItem={(c) => (
          <View className="pb-3">
            <ContributionCard
              contribution={c}
              guard={canConfirm ? confirmGuard(c, { memberId: ownMemberId, userId: ownUserId }) : 'decided'}
              busy={decide.isPending && picked?.id === c.id}
              onConfirm={() => {
                setPicked(c);
                confirmRef.current?.present();
              }}
              onReject={() => {
                setPicked(c);
                rejectRef.current?.present();
              }}
            />
          </View>
        )}
        empty={
          <EmptyState
            icon={Inbox}
            title={status === 'PENDING' ? 'Nothing to confirm' : 'No contributions here'}
            description={status === 'PENDING' ? 'Contributions that have been recorded and are waiting for a second officer to confirm show up here.' : 'Try another filter.'}
            actionLabel={canRecord && status === 'PENDING' ? 'Record contributions' : undefined}
            onAction={canRecord && status === 'PENDING' ? () => router.push('/(app)/(tabs)/manage/welfare/contributions/record' as never) : undefined}
          />
        }
      />

      <ConfirmSheet
        ref={confirmRef}
        title="Confirm this contribution?"
        description={picked ? `${formatMoney(picked.amount)} from ${picked.member.firstName} ${picked.member.lastName} is added to ${picked.fund.name}. Only confirm money you have seen.` : ''}
        confirmLabel="Confirm"
        destructive={false}
        onConfirm={confirm}
      />
      <ReasonSheet ref={rejectRef} title="Reject this contribution?" description="Nothing is added to the fund. Say why, so it is on record." confirmLabel="Reject" loading={decide.isPending} onConfirm={reject} />
    </Screen>
  );
}
