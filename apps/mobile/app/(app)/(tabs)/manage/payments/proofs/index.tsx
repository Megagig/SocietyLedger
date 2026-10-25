import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { ProofRow } from '@/features/nigerianPayments/components/ProofRow';
import { PROOF_STATUS_LABELS } from '@/features/nigerianPayments/labels';
import { PROOFS_VIEW_ACCESS, usePendingProofCount, useProofs } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import type { ProofListItemDTO, ProofStatus } from '@/types/api/paymentProofsManage';

const EMPTY_COPY: Record<ProofStatus, { title: string; description: string }> = {
  PENDING: { title: 'Nothing waiting', description: 'When a member submits a payment proof, it shows up here and you get a notification.' },
  APPROVED: { title: 'No verified proofs yet', description: 'Proofs you verify show up here.' },
  REJECTED: { title: 'No rejected proofs', description: 'Proofs you reject show up here, with your reason.' },
};

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 PY2 — payment proofs by status (Waiting / Verified / Rejected), newest first. */
export default function ProofsQueueScreen() {
  const router = useRouter();
  const canView = useCan(PROOFS_VIEW_ACCESS);
  const [status, setStatus] = useState<ProofStatus>('PENDING');
  const query = useProofs(status);
  const waiting = usePendingProofCount().data ?? 0;
  const proofs = useMemo(() => query.data?.pages.flatMap((page) => page.proofs) ?? [], [query.data]);
  const back = () => router.back();
  const openProof = (proof: ProofListItemDTO) => router.push(`/(app)/(tabs)/manage/payments/proofs/${proof.id}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payment proofs" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const empty = EMPTY_COPY[status];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Payment proofs" onBack={back} docsKey="PY2" />

      <View className="pb-3">
        <SegmentedControl<ProofStatus>
          options={[
            { label: waiting > 0 ? `${PROOF_STATUS_LABELS.PENDING} (${waiting})` : PROOF_STATUS_LABELS.PENDING, value: 'PENDING' },
            { label: PROOF_STATUS_LABELS.APPROVED, value: 'APPROVED' },
            { label: PROOF_STATUS_LABELS.REJECTED, value: 'REJECTED' },
          ]}
          value={status}
          onChange={setStatus}
          testID="proofs-status"
        />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={proofs}
          keyExtractor={(proof) => String(proof.id)}
          renderItem={({ item, index }) => <ProofRow proof={item} position={positionOf(index, proofs.length)} onPress={openProof} />}
          ListEmptyComponent={<EmptyState icon={ReceiptText} title={empty.title} description={empty.description} />}
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
    </Screen>
  );
}
