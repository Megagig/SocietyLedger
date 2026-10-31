import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CircleDollarSign } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { AjoActionSheet } from '@/features/ajo/components/AjoActionSheet';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoMoney } from '@/features/ajo/components/AjoMoney';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { AjoStatusBadge } from '@/features/ajo/components/AjoStatusBadge';
import { ConfirmPaymentSheet, type ConfirmPaymentSheetHandle } from '@/features/ajo/components/ConfirmPaymentSheet';
import { formatDay, formatKobo, formatMoment } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { usePeople, useQueue } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { QueueContributionDTO } from '@/types/api/ajo';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'REPORTED', label: 'Transfers to confirm' },
  { value: 'CASH_RECEIVED', label: 'Cash waiting' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Turned down' },
  { value: 'REVERSED', label: 'Reversed' },
];

/** THO4 (transfers and cash): the circle's payments, to confirm against the bank statement, turn down, or reverse with a reason. */
export default function CirclePaymentsScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { reconcile } = useAjoCan();
  const [status, setStatus] = useState('REPORTED');
  const queue = useQueue(groupId, status || undefined);
  const people = usePeople(groupId);
  const names = new Map((people.data ?? []).map((p) => [p.membershipId, p.name]));
  const confirmSheet = useRef<ConfirmPaymentSheetHandle>(null);
  const rejectSheet = useRef<BottomSheetModal>(null);
  const reverseSheet = useRef<BottomSheetModal>(null);
  const [rejecting, setRejecting] = useState<QueueContributionDTO | null>(null);
  const [reversing, setReversing] = useState<QueueContributionDTO | null>(null);
  const [proofProblem, setProofProblem] = useState<string | null>(null);
  const can = reconcile && canWrite;
  const sendWaiting = useAjoAction<void, { sent: number; stillQueued: number }>(() => ajoApi.sendQueuedReceipts());
  const nameOf = (id: number) => names.get(id) ?? 'A member';

  const openProof = async (id: number) => {
    setProofProblem(null);
    try {
      const { url } = await ajoApi.proofLink(id);
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      setProofProblem(error instanceof ApiError ? error.message : 'Could not open the proof.');
    }
  };

  return (
    <AjoScreen title="Payments" access={['AJO_MANAGE', 'AJO_RECONCILE']} refreshing={queue.isRefetching} onRefresh={() => void queue.refetch()}>
      <Text variant="body" tone="secondary">
        Only confirmed money counts. Check each transfer against the bank statement before you confirm it. Cash recorded by a collector is confirmed when the collector&apos;s handover is reconciled.
      </Text>
      {can ? (
        <View className="flex-row">
          <Button
            size="sm"
            variant="secondary"
            loading={sendWaiting.isPending}
            onPress={async () => {
              setProofProblem(null);
              try {
                const r = await sendWaiting.mutateAsync();
                toast.success(r.stillQueued ? `${r.sent} sent, ${r.stillQueued} still waiting (check your SMS credits).` : `${r.sent} receipt${r.sent === 1 ? '' : 's'} sent.`);
              } catch (error) {
                setProofProblem(error instanceof ApiError ? error.message : 'Could not send the waiting receipts.');
              }
            }}
            testID="ajo-send-waiting-receipts"
          >
            Send waiting receipts
          </Button>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterChip key={f.value} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
        ))}
      </View>
      {proofProblem ? (
        <Text variant="body" tone="danger">
          {proofProblem}
        </Text>
      ) : null}

      {queue.isPending ? (
        <AjoLoading />
      ) : queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : queue.items.length > 0 ? (
        <View className="gap-3">
          {queue.items.map((c) => (
            <Card key={c.id} testID={`ajo-payment-${c.id}`}>
              <View className="gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="h3">{nameOf(c.membershipId)}</Text>
                    {c.reference ? (
                      <Text variant="caption" tone="tertiary">
                        {c.reference}
                      </Text>
                    ) : null}
                  </View>
                  <AjoMoney kobo={c.amountKobo} />
                </View>
                <Text variant="caption" tone="secondary">
                  {c.method === 'CASH' ? 'Cash' : 'Bank transfer'} · {formatMoment(c.receivedAt)}
                  {c.paidOn ? ` · paid ${formatDay(c.paidOn)}` : ''}
                  {c.bankReference ? ` · ref ${c.bankReference}` : ''}
                  {c.possibleDuplicateOf ? ' · may be a repeat' : ''}
                  {c.missingFromHandover ? ' · missing from handover' : ''}
                  {c.reversalReason ? ` · reversed: ${c.reversalReason}` : ''}
                </Text>
                <AjoStatusBadge status={c.reversed ? 'REVERSED' : c.status} />
                <View className="flex-row flex-wrap gap-2">
                  {c.hasProof ? (
                    <Button size="sm" variant="ghost" onPress={() => void openProof(c.id)} testID={`ajo-proof-${c.id}`}>
                      See slip
                    </Button>
                  ) : null}
                  {can && c.status === 'REPORTED' ? (
                    <>
                      <Button size="sm" onPress={() => confirmSheet.current?.open(c, nameOf(c.membershipId))} testID={`ajo-confirm-${c.id}`}>
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setRejecting(c);
                          rejectSheet.current?.present();
                        }}
                        testID={`ajo-reject-${c.id}`}
                      >
                        Turn down
                      </Button>
                    </>
                  ) : null}
                  {can && c.counts ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setReversing(c);
                        reverseSheet.current?.present();
                      }}
                      testID={`ajo-reverse-${c.id}`}
                    >
                      Reverse
                    </Button>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="caption" tone="tertiary">
              Showing {queue.items.length} of {queue.total}
            </Text>
            {queue.hasMore ? (
              <Button size="sm" variant="secondary" loading={queue.isFetchingNextPage} onPress={() => void queue.fetchNextPage()}>
                Show more
              </Button>
            ) : null}
          </View>
        </View>
      ) : (
        <EmptyState icon={CircleDollarSign} title={status === 'REPORTED' ? 'No transfers are waiting to be confirmed.' : 'Nothing here.'} />
      )}

      <ConfirmPaymentSheet ref={confirmSheet} />
      <AjoActionSheet
        ref={rejectSheet}
        title="Turn down this payment"
        summary={rejecting ? `${nameOf(rejecting.membershipId)} reported ${formatKobo(rejecting.amountKobo)}. It will not count, and they are told why.` : undefined}
        confirmLabel="Turn it down"
        destructive
        reasonMin={5}
        reasonLabel="Why (the member is told)"
        onConfirm={({ reason }) => ajoApi.reject(rejecting?.id ?? 0, reason)}
        successMessage="The payment was turned down."
        testID="ajo-reject-sheet"
      />
      <AjoActionSheet
        ref={reverseSheet}
        title="Reverse this payment"
        summary={reversing ? `${nameOf(reversing.membershipId)}'s ${formatKobo(reversing.amountKobo)} will stop counting, and what it covered becomes owed again. The original stays on the record with your reason.` : undefined}
        confirmLabel="Reverse it"
        destructive
        reasonMin={10}
        reasonLabel="Why is it being reversed"
        onConfirm={({ reason }) => ajoApi.reverse(reversing?.id ?? 0, reason)}
        successMessage="The payment was reversed and the reason recorded."
        testID="ajo-reverse-sheet"
      />
    </AjoScreen>
  );
}
