import * as WebBrowser from 'expo-web-browser';
import { CircleDollarSign } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

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
import { RecordPaymentSheet, type RecordPaymentSheetHandle } from '@/features/ajo/components/RecordPaymentSheet';
import { formatDay, formatKobo, formatMoment } from '@/features/ajo/format';
import { useWaitingPayments } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';
import type { WaitingPaymentDTO } from '@/types/api/ajo';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

const FILTERS = [
  { value: 'REPORTED', label: 'Transfers to confirm' },
  { value: 'CASH_RECEIVED', label: 'Cash waiting' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Turned down' },
];

/**
 * Payments across every circle, in one place: what members have reported and are waiting to be confirmed against the bank statement,
 * with the slip, and Confirm or Turn down. An officer can also record a payment for a member who paid but did not report it.
 */
export default function AllPaymentsScreen() {
  const { canWrite } = useAjoWrite();
  const { reconcile, manage } = useAjoCan();
  const [status, setStatus] = useState('REPORTED');
  const waiting = useWaitingPayments(status);
  const confirmSheet = useRef<ConfirmPaymentSheetHandle>(null);
  const rejectSheet = useRef<BottomSheetModal>(null);
  const recordSheet = useRef<RecordPaymentSheetHandle>(null);
  const [rejecting, setRejecting] = useState<WaitingPaymentDTO | null>(null);
  const [proofProblem, setProofProblem] = useState<string | null>(null);
  const can = reconcile && canWrite;

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
    <AjoScreen title="Payments" access={['AJO_MANAGE', 'AJO_RECONCILE']} refreshing={waiting.isRefetching} onRefresh={() => void waiting.refetch()}>
      <Text variant="body" tone="secondary">
        Only confirmed money counts. Check each transfer against the bank statement before you confirm it. Cash recorded by a collector is confirmed when the collector&apos;s handover is counted.
      </Text>
      {(reconcile || manage) && canWrite ? (
        <View className="flex-row">
          <Button size="sm" onPress={() => recordSheet.current?.open()} testID="ajo-record-payment">
            Record a payment
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

      {waiting.isPending ? (
        <AjoLoading />
      ) : waiting.isError ? (
        <ErrorState error={waiting.error} onRetry={() => waiting.refetch()} />
      ) : waiting.data.items.length > 0 ? (
        <View className="gap-3">
          {waiting.data.items.map((c) => (
            <Card key={c.id} testID={`ajo-payment-${c.id}`}>
              <View className="gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="h3">{c.memberName}</Text>
                    <Text variant="caption" tone="tertiary">
                      {c.groupName}
                    </Text>
                  </View>
                  <AjoMoney kobo={c.amountKobo} />
                </View>
                <Text variant="caption" tone="secondary">
                  {c.method === 'CASH' ? 'Cash' : 'Bank transfer'} · reported {formatMoment(c.receivedAt)}
                  {c.paidOn ? ` · paid ${formatDay(c.paidOn)}` : ''}
                  {c.bankReference ? ` · ref ${c.bankReference}` : ''}
                  {c.possibleDuplicateOf ? ' · may be a repeat' : ''}
                </Text>
                <AjoStatusBadge status={c.status} />
                <View className="flex-row flex-wrap gap-2">
                  {c.hasProof ? (
                    <Button size="sm" variant="ghost" onPress={() => void openProof(c.id)} testID={`ajo-proof-${c.id}`}>
                      See slip
                    </Button>
                  ) : null}
                  {can && c.status === 'REPORTED' ? (
                    <>
                      <Button size="sm" onPress={() => confirmSheet.current?.open(c, c.memberName)} testID={`ajo-confirm-${c.id}`}>
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
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={CircleDollarSign} title={status === 'REPORTED' ? 'Nothing is waiting to be confirmed.' : 'No payments here.'} description="When a member reports a transfer, it shows here with the slip." />
      )}

      <ConfirmPaymentSheet ref={confirmSheet} />
      <AjoActionSheet
        ref={rejectSheet}
        title="Turn down this payment"
        summary={rejecting ? `${rejecting.memberName} reported ${formatKobo(rejecting.amountKobo)}. It will not count, and they are told why.` : undefined}
        confirmLabel="Turn it down"
        destructive
        reasonMin={5}
        reasonLabel="Why (the member is told)"
        onConfirm={({ reason }) => ajoApi.reject(rejecting?.id ?? 0, reason)}
        successMessage="The payment was turned down."
        testID="ajo-reject-sheet"
      />
      <RecordPaymentSheet ref={recordSheet} canConfirm={reconcile} />
    </AjoScreen>
  );
}
