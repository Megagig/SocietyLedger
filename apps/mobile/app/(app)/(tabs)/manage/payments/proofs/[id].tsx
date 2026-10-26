import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { FactRow } from '@/features/members/components/FactRow';
import { DeclaredItemsCard } from '@/features/nigerianPayments/components/DeclaredItemsCard';
import { ProofReceiptCard } from '@/features/nigerianPayments/components/ProofReceiptCard';
import { RejectProofSheet } from '@/features/nigerianPayments/components/RejectProofSheet';
import { methodLabel, PROOF_STATUS_LABELS, proofMemberName } from '@/features/nigerianPayments/labels';
import { useDecideProof } from '@/features/nigerianPayments/mutations';
import { PROOFS_DECIDE_ACCESS, PROOFS_VIEW_ACCESS, useProof } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney, toDecimal } from '@/lib/money';
import { useSessionStore } from '@/stores/session';

/** project-overview.md §6.9 PY3 — one payment proof: the receipt, the charges to match, and Verify / Reject while it's waiting. */
export default function ProofDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const canView = useCan(PROOFS_VIEW_ACCESS);
  const canDecide = useCan(PROOFS_DECIDE_ACCESS);
  const myUserId = useSessionStore((s) => s.user?.id);
  const query = useProof(id);
  const decide = useDecideProof(id);
  const verifySheetRef = useRef<BottomSheetModal>(null);
  const rejectSheetRef = useRef<BottomSheetModal>(null);

  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payment proof" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const proof = query.data;
  const pending = proof?.status === 'PENDING';
  const isOwn = Boolean(proof && myUserId !== undefined && proof.member.userId === myUserId);
  const declared = proof?.declaredItems ?? [];
  const hasNothingToApply = Boolean(proof && declared.length === 0 && !proof.bankTransfer);
  const recordsNothing = Boolean(proof && declared.length > 0 && toDecimal(proof.declaredBalance).lte(0));
  const showActions = Boolean(pending && canDecide && !isOwn);

  const fail = (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : 'Could not save your decision. Try again.');
    // Another officer may have decided it first — show where it really stands.
    void query.refetch();
  };

  const verify = () =>
    decide.mutate(
      { status: 'APPROVED' },
      {
        onSuccess: () => {
          verifySheetRef.current?.dismiss();
          toast.success('Payment verified');
          router.back();
        },
        onError: (error) => {
          verifySheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  const reject = (rejectionReason: string) =>
    decide.mutate(
      { status: 'REJECTED', rejectionReason },
      {
        onSuccess: () => {
          rejectSheetRef.current?.dismiss();
          toast.success('Proof rejected. The member has been told why.');
          router.back();
        },
        onError: (error) => {
          rejectSheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Payment proof" onBack={back} docsKey="PY3" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={72} radius="lg" />
          <Skeleton width="100%" height={220} radius="lg" />
          <Skeleton width="100%" height={140} radius="md" />
        </View>
      ) : query.isError || !proof ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <Pressable
            onPress={() => router.push(`/(app)/(tabs)/manage/members/${proof.member.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`${proofMemberName(proof)}, open member profile`}
            className="flex-row items-center gap-3"
            testID="proof-member"
          >
            <Avatar name={proofMemberName(proof)} colorSeed={proof.member.id} size={40} imageUrl={proof.member.thumbUrl} />
            <View className="flex-1">
              <Text variant="h3" numberOfLines={1}>
                {proofMemberName(proof)}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {`${proof.member.memberId} · ${methodLabel(proof.paymentMethod)} · ${formatDate(proof.uploadedAt, 'long')}`}
              </Text>
            </View>
            <StatusChip status={proof.status.toLowerCase()} label={PROOF_STATUS_LABELS[proof.status]} />
          </Pressable>

          {isOwn && pending ? (
            <Text variant="body" tone="warning" testID="proof-own-note">
              You submitted this proof yourself, so another officer needs to verify or reject it.
            </Text>
          ) : null}
          {proof.status === 'REJECTED' && proof.rejectionReason ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4">
              <Text variant="label" tone="danger">
                Rejected{proof.verifiedAt ? ` on ${formatDate(proof.verifiedAt, 'long')}` : ''}
              </Text>
              <Text variant="body">{proof.rejectionReason}</Text>
            </View>
          ) : null}
          {proof.status === 'APPROVED' && proof.verifiedAt ? (
            <Text variant="body" tone="success">
              {`Verified on ${formatDate(proof.verifiedAt, 'long')}.`}
            </Text>
          ) : null}

          <Section title="Receipt">
            <ProofReceiptCard proof={proof} />
          </Section>

          <Section title="Charges to match">
            {declared.length > 0 ? (
              <View className="gap-3">
                <DeclaredItemsCard items={declared} total={proof.declaredBalance} />
                {recordsNothing && pending ? (
                  <Text variant="caption" tone="secondary">
                    These charges are already settled, voided or waived, so verifying records no new payment.
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="gap-1 rounded-lg border border-border bg-surface p-4 dark:border-transparent">
                <Text variant="body" tone={hasNothingToApply && pending ? 'warning' : 'secondary'}>
                  {proof.bankTransfer
                    ? 'This proof is linked to a bank transfer. Verifying confirms that transfer.'
                    : "This proof isn't linked to any charge, so verifying it would record no payment. Reject it with a reason, and ask the member to submit it again."}
                </Text>
              </View>
            )}
          </Section>

          {proof.notes ? (
            <Section title="Note from the member">
              <Text variant="body" tone="secondary">
                {proof.notes}
              </Text>
            </Section>
          ) : null}

          {proof.bankTransfer ? (
            <Section title="Linked bank transfer">
              <ListGroup>
                <FactRow label="Reference" value={proof.bankTransfer.reference} />
                <FactRow label="Amount" amount={proof.bankTransfer.amount} />
              </ListGroup>
            </Section>
          ) : null}
        </View>
      )}

      {showActions ? (
        // StickyFooter is already a row with a gap, so each button's wrapper sits directly in it (a nested row would shrink to its content
        // and collapse both buttons to a sliver).
        <StickyFooter>
          <View className="flex-1">
            <Button variant="secondary" fullWidth disabled={decide.isPending} onPress={() => rejectSheetRef.current?.present()} testID="proof-reject">
              Reject
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" fullWidth disabled={hasNothingToApply || decide.isPending} onPress={() => verifySheetRef.current?.present()} testID="proof-verify">
              Verify payment
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={verifySheetRef}
        title="Verify this payment?"
        description={
          proof
            ? recordsNothing || declared.length === 0
              ? 'This marks the proof verified. No new payment is recorded. You can’t undo it.'
              : `This records ${formatMoney(proof.declaredBalance)} across ${declared.filter((i) => toDecimal(i.balance).gt(0)).length} charge(s) and marks them paid. You can’t undo it.`
            : ''
        }
        confirmLabel="Verify payment"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={verify}
      />
      <RejectProofSheet ref={rejectSheetRef} memberName={proof ? proofMemberName(proof) : 'The member'} loading={decide.isPending} onSubmit={reject} onDismiss={() => undefined} />
    </Screen>
  );
}
