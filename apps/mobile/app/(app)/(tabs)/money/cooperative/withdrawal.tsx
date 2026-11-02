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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { CoopTile } from '@/features/coopEnhanced/components/CoopTile';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { WITHDRAWAL_STATUS_KEYS, WITHDRAWAL_STATUS_LABELS, withdrawalProgress } from '@/features/coopEnhanced/labels';
import { useCancelWithdrawal, useMyWithdrawals, useWithdrawalSummary } from '@/features/coopEnhanced/queries';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_WITHDRAW_ACCESS } from '@/lib/permissions';
import type { WithdrawalDTO } from '@/types/api/coopEnhanced';

/**
 * My Withdrawal: ask to take money out of a withdrawable savings type and follow the request. The balance only moves when an officer
 * finally approves it; until then nothing leaves your savings, and you can cancel.
 */
export default function MyWithdrawalScreen() {
  const router = useRouter();
  const summary = useWithdrawalSummary();
  const history = useMyWithdrawals();
  const cancel = useCancelWithdrawal();
  const cancelRef = useRef<BottomSheetModal>(null);
  const [picked, setPicked] = useState<WithdrawalDTO | null>(null);

  const refresh = () => {
    void summary.refetch();
    void history.refetch();
  };

  const doCancel = () => {
    if (!picked) return;
    cancel.mutate(picked.id, {
      onSuccess: () => {
        cancelRef.current?.dismiss();
        toast.success('Withdrawal cancelled');
      },
      onError: (error) => {
        cancelRef.current?.dismiss();
        toast.error(error instanceof ApiError ? error.message : 'Could not cancel it. Try again.');
      },
    });
  };

  const data = summary.data;

  return (
    <OwnPage
      title="My Withdrawal"
      subject="withdrawals"
      access={COOPERATIVE_WITHDRAW_ACCESS}
      refreshing={summary.isRefetching || history.isRefetching}
      onRefresh={refresh}
    >
      <View className="gap-5 pb-8">
        <Text variant="body" tone="secondary">
          Manage and track your withdrawal requests.
        </Text>

        {summary.isPending ? (
          <Skeleton width="100%" height={180} radius="lg" />
        ) : summary.isError || !data ? (
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        ) : (
          <>
            <View className="gap-3" accessibilityLabel="Withdrawal summary">
              <View className="flex-row gap-3">
                <CoopTile label="Available to withdraw from" value={data.totalBalance} tone="info" />
                <CoopTile label="Total withdrawals" value={data.totalWithdrawals} tone="success" />
              </View>
              <View className="flex-row gap-3">
                <CoopTile label="Monthly limit" value={data.monthlyLimit} tone="neutral" hint={data.monthlyLimit ? undefined : 'No monthly limit set'} />
                <CoopTile
                  label="Last withdrawal"
                  value={data.lastWithdrawal?.amount ?? null}
                  tone="warning"
                  hint={data.lastWithdrawal?.at ? formatDate(data.lastWithdrawal.at, 'short') : 'No withdrawals yet'}
                />
              </View>
            </View>
            <Button variant="primary" disabled={data.accounts.length === 0} onPress={() => router.push('/money/cooperative/withdrawal-new' as never)} testID="withdrawal-new">
              New withdrawal request
            </Button>
          </>
        )}

        {history.isPending ? (
          <Skeleton width="100%" height={120} radius="lg" />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : (history.data?.requests ?? []).length === 0 ? (
          <EmptyState icon={Banknote} title="No withdrawal requests found." description="When you ask to withdraw, it will appear here with where it has got to." />
        ) : (
          <View className="gap-3">
            {history.data?.requests.map((w) => (
              <Card key={w.id}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Money value={w.amount} size="h3" />
                    <Text variant="caption" tone="secondary">{`${w.accountTypeName} · requested ${formatDate(w.createdAt, 'short')}`}</Text>
                  </View>
                  <StatusChip status={WITHDRAWAL_STATUS_KEYS[w.status]} label={WITHDRAWAL_STATUS_LABELS[w.status]} />
                </View>
                <Text variant="body" tone="secondary" className="mt-2">
                  {withdrawalProgress(w)}
                </Text>
                {w.reason ? (
                  <Text variant="caption" tone="secondary" className="mt-1">{`Your reason: ${w.reason}`}</Text>
                ) : null}
                {w.status === 'PENDING_REVIEW' || w.status === 'PENDING_APPROVAL' ? (
                  <View className="mt-3 flex-row">
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      loading={cancel.isPending && picked?.id === w.id}
                      onPress={() => {
                        setPicked(w);
                        cancelRef.current?.present();
                      }}
                      testID={`withdrawal-cancel-${w.id}`}
                    >
                      Cancel request
                    </Button>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </View>

      <ConfirmSheet
        ref={cancelRef}
        title="Cancel this request?"
        description="Nothing has left your savings. You can ask again whenever you like."
        confirmLabel="Cancel request"
        onConfirm={doCancel}
      />
    </OwnPage>
  );
}
