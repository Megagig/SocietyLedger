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
import { ReasonSheet } from '@/features/cash/components/ReasonSheet';
import { SlipCard } from '@/features/cash/components/SlipCard';
import { LODGMENT_STATUS_LABELS, VERIFY_LODGMENT_EXPLAINER } from '@/features/cash/labels';
import { useDecideLodgment } from '@/features/cash/mutations';
import { CASH_ANY_ACCESS, CASH_VERIFY_ACCESS, useCashLodgment } from '@/features/cash/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { formatAccountNumber } from '@/features/nigerianPayments/labels';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useSessionStore } from '@/stores/session';

/** project-overview.md §6.9 CA8 — one lodgment: the slip, where it went, what it covers, and Verify / Reject for a different officer. */
export default function LodgmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const canView = useCan(CASH_ANY_ACCESS);
  const canVerify = useCan(CASH_VERIFY_ACCESS);
  const userId = useSessionStore((state) => state.user?.id);
  const query = useCashLodgment(id);
  const decide = useDecideLodgment(id);
  const verifySheetRef = useRef<BottomSheetModal>(null);
  const rejectSheetRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodgment" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const lodgment = query.data;
  const pending = lodgment?.status === 'PENDING';
  const own = lodgment !== undefined && lodgment.lodgedBy.id === userId;

  const fail = (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : 'Could not save your decision. Try again.');
    // Someone else may have decided it first — show where it really stands.
    void query.refetch();
  };

  const verify = () =>
    decide.mutate(
      { status: 'VERIFIED' },
      {
        onSuccess: () => {
          verifySheetRef.current?.dismiss();
          toast.success('Lodgment verified');
        },
        onError: (error) => {
          verifySheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  const reject = (reason: string) =>
    decide.mutate(
      { status: 'REJECTED', reason },
      {
        onSuccess: () => {
          rejectSheetRef.current?.dismiss();
          toast.success('Lodgment rejected');
        },
        onError: (error) => {
          rejectSheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Lodgment" onBack={back} docsKey="CA8" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="100%" height={220} radius="lg" />
        </View>
      ) : query.isError || !lodgment ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Money value={lodgment.amount} size="h1" />
            <StatusChip status={lodgment.status.toLowerCase()} label={LODGMENT_STATUS_LABELS[lodgment.status]} />
            <Text variant="caption" tone="secondary">
              {`${lodgment.lodgedBy.name} · paid in ${formatDate(lodgment.depositDate, 'long')}`}
            </Text>
          </View>

          {lodgment.status === 'REJECTED' && lodgment.rejectionReason ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4">
              <Text variant="label" tone="danger">
                Rejected{lodgment.verifiedAt ? ` on ${formatDate(lodgment.verifiedAt, 'long')}` : ''}
              </Text>
              <Text variant="body">{lodgment.rejectionReason}</Text>
              {own ? (
                <Text variant="caption" tone="secondary">
                  The cash is back in your hand. Fix the problem and lodge it again.
                </Text>
              ) : null}
            </View>
          ) : null}
          {lodgment.status === 'VERIFIED' && lodgment.verifiedAt ? (
            <Text variant="body" tone="success">
              {`Verified${lodgment.verifiedBy ? ` by ${lodgment.verifiedBy.name}` : ''} on ${formatDate(lodgment.verifiedAt, 'long')}.`}
            </Text>
          ) : null}
          {lodgment.shortfall > 0 ? (
            <View className="gap-1 rounded-lg bg-warning-soft p-4" testID="lodgment-shortfall">
              <Text variant="label" tone="warning">
                Lodged short
              </Text>
              <Text variant="body">{`${formatMoney(lodgment.shortfall)} less than was collected.${lodgment.shortfallReason ? ` Reason given: ${lodgment.shortfallReason}` : ''}`}</Text>
            </View>
          ) : null}

          <Section title="Deposit slip">
            <SlipCard lodgmentId={lodgment.id} hasSlip={lodgment.hasSlip} />
          </Section>

          <Section title="Paid into">
            <ListGroup>
              <FactRow label="Bank" value={lodgment.bankAccount.bankName} />
              <FactRow label="Account name" value={lodgment.bankAccount.accountName} />
              <FactRow label="Account number" value={lodgment.bankAccount.accountNumber ? formatAccountNumber(lodgment.bankAccount.accountNumber) : null} />
              <FactRow label="Bank reference" value={lodgment.bankReference} />
            </ListGroup>
          </Section>

          <Section title="Cash it covers">
            <ListGroup>
              {lodgment.collections.map((c) => (
                <ListItem
                  key={c.id}
                  title={c.title}
                  trailing={<Money value={c.amount} size="body-strong" />}
                  showChevron
                  onPress={() => router.push(`/(app)/(tabs)/manage/cash/collections/${c.id}` as never)}
                  testID={`lodgment-collection-${c.id}`}
                />
              ))}
              <FactRow label="Should have been lodged" amount={lodgment.expectedAmount} />
            </ListGroup>
          </Section>
        </View>
      )}

      {pending && canVerify && !own ? (
        // StickyFooter is already a row with a gap — the wrappers sit directly in it.
        <StickyFooter>
          <View className="flex-1">
            <Button variant="secondary" fullWidth disabled={decide.isPending} onPress={() => rejectSheetRef.current?.present()} testID="lodgment-reject">
              Reject
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" fullWidth disabled={decide.isPending} onPress={() => verifySheetRef.current?.present()} testID="lodgment-verify">
              Verify lodgment
            </Button>
          </View>
        </StickyFooter>
      ) : null}
      {pending && own ? (
        <View className="pb-6">
          <Text variant="caption" tone="secondary" align="center">
            You made this lodgment, so another officer has to check it.
          </Text>
        </View>
      ) : null}

      <ConfirmSheet
        ref={verifySheetRef}
        title="Verify this lodgment?"
        description={VERIFY_LODGMENT_EXPLAINER}
        confirmLabel="Verify lodgment"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={verify}
      />
      <ReasonSheet
        ref={rejectSheetRef}
        title="Reject this lodgment?"
        description="Use this when the amount isn't on the bank statement or the slip doesn't match. The cash goes back to the officer to lodge again."
        placeholder="Why are you rejecting this lodgment?"
        confirmLabel="Reject lodgment"
        keepLabel="Not yet"
        loading={decide.isPending}
        onSubmit={reject}
        testID="reject-lodgment"
      />
    </Screen>
  );
}
