import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
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
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { FactRow } from '@/features/members/components/FactRow';
import { RejectTransferSheet } from '@/features/nigerianPayments/components/RejectTransferSheet';
import { formatAccountNumber, PROOF_STATUS_LABELS, TRANSFER_STATUS_LABELS, transferMemberName, VERIFY_TRANSFER_EXPLAINER } from '@/features/nigerianPayments/labels';
import { useDecideTransfer } from '@/features/nigerianPayments/mutations';
import { TRANSFERS_DECIDE_ACCESS, TRANSFERS_RECORD_ACCESS, TRANSFERS_VIEW_ACCESS, useTransfer } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.9 PY5 — one bank transfer: what was recorded, where it landed, who it's for, and Verify / Reject while it waits. */
export default function TransferDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const canView = useCan(TRANSFERS_VIEW_ACCESS);
  const canDecide = useCan(TRANSFERS_DECIDE_ACCESS);
  const canEdit = useCan(TRANSFERS_RECORD_ACCESS);
  const query = useTransfer(id);
  const decide = useDecideTransfer(id);
  const verifySheetRef = useRef<BottomSheetModal>(null);
  const rejectSheetRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Bank transfer" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const transfer = query.data;
  const pending = transfer?.status === 'PENDING';

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
          toast.success('Transfer verified');
        },
        onError: (error) => {
          verifySheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  const reject = (reason: string) =>
    decide.mutate(
      { status: 'REJECTED', notes: reason },
      {
        onSuccess: () => {
          rejectSheetRef.current?.dismiss();
          toast.success('Transfer rejected');
        },
        onError: (error) => {
          rejectSheetRef.current?.dismiss();
          fail(error);
        },
      },
    );

  return (
    <Screen
      edges={['top', 'bottom']}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
    >
      <ScreenHeader
        title="Bank transfer"
        onBack={back}
        docsKey="PY5"
        rightActions={
          transfer && pending && canEdit ? (
            <IconButton icon={Pencil} accessibilityLabel="Edit transfer" onPress={() => router.push(`/(app)/(tabs)/manage/payments/transfers/form?id=${transfer.id}` as never)} testID="transfer-edit" />
          ) : undefined
        }
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !transfer ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Money value={transfer.amount} size="h1" />
            <StatusChip status={transfer.status.toLowerCase()} label={TRANSFER_STATUS_LABELS[transfer.status]} />
            <Text variant="caption" tone="secondary">
              {`${transfer.reference} · ${formatDate(transfer.transferDate, 'long')}`}
            </Text>
          </View>

          {transfer.status === 'REJECTED' && transfer.notes ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4">
              <Text variant="label" tone="danger">
                Rejected{transfer.verifiedAt ? ` on ${formatDate(transfer.verifiedAt, 'long')}` : ''}
              </Text>
              <Text variant="body">{transfer.notes}</Text>
            </View>
          ) : null}
          {transfer.status === 'VERIFIED' && transfer.verifiedAt ? (
            <Text variant="body" tone="success">
              {`Verified on ${formatDate(transfer.verifiedAt, 'long')}.`}
            </Text>
          ) : null}
          {transfer.status === 'MATCHED' ? (
            <Text variant="body" tone="secondary">
              This transfer has been matched to a charge in reconciliation.
            </Text>
          ) : null}

          <Section title="Sent by">
            <ListGroup>
              <FactRow label="Bank" value={transfer.senderBankName} />
              <FactRow label="Account name" value={transfer.senderAccountName} />
              <FactRow label="Account number" value={transfer.senderAccountNumber ? formatAccountNumber(transfer.senderAccountNumber) : null} />
              <FactRow label="Narration" value={transfer.narration} />
            </ListGroup>
          </Section>

          <Section title="Received into">
            <ListGroup>
              {transfer.bankAccount ? (
                <>
                  <FactRow label="Bank" value={transfer.bankAccount.bankName} />
                  <FactRow label="Account name" value={transfer.bankAccount.accountName} />
                  <FactRow label="Account number" value={formatAccountNumber(transfer.bankAccount.accountNumber)} />
                </>
              ) : (
                <FactRow label="Account" value="Not stated" />
              )}
            </ListGroup>
          </Section>

          <Section title="For">
            <ListGroup>
              {transfer.member ? (
                <ListItem
                  title={transferMemberName(transfer) ?? 'Member'}
                  meta={transfer.member.memberId}
                  showChevron
                  onPress={() => router.push(`/(app)/(tabs)/manage/members/${transfer.member!.id}` as never)}
                  testID="transfer-member"
                />
              ) : (
                <FactRow label="Member" value="Not stated" />
              )}
              {transfer.transaction ? (
                <FactRow label="Linked charge" value={`${transfer.transaction.category.name} · ${transfer.transaction.referenceNumber ?? `#${transfer.transaction.id}`}`} />
              ) : null}
            </ListGroup>
          </Section>

          {transfer.paymentProofs.length > 0 ? (
            <Section title="Payment proofs">
              <ListGroup>
                {transfer.paymentProofs.map((proof) => (
                  <ListItem
                    key={proof.id}
                    title={proof.filename ?? 'Written note'}
                    meta={`${PROOF_STATUS_LABELS[proof.status]} · ${formatDate(proof.uploadedAt, 'long')}`}
                    showChevron
                    onPress={() => router.push(`/(app)/(tabs)/manage/payments/proofs/${proof.id}` as never)}
                    testID={`transfer-proof-${proof.id}`}
                  />
                ))}
              </ListGroup>
            </Section>
          ) : null}

          {transfer.notes && transfer.status !== 'REJECTED' ? (
            <Section title="Notes">
              <Text variant="body" tone="secondary">
                {transfer.notes}
              </Text>
            </Section>
          ) : null}
        </View>
      )}

      {pending && canDecide ? (
        // StickyFooter is already a row with a gap — see the proof screen for why the wrappers sit directly in it.
        <StickyFooter>
          <View className="flex-1">
            <Button variant="secondary" fullWidth disabled={decide.isPending} onPress={() => rejectSheetRef.current?.present()} testID="transfer-reject">
              Reject
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" fullWidth disabled={decide.isPending} onPress={() => verifySheetRef.current?.present()} testID="transfer-verify">
              Verify transfer
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={verifySheetRef}
        title="Verify this transfer?"
        description={`${VERIFY_TRANSFER_EXPLAINER} You can’t undo it.`}
        confirmLabel="Verify transfer"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={verify}
      />
      <RejectTransferSheet ref={rejectSheetRef} loading={decide.isPending} onSubmit={reject} onDismiss={() => undefined} />
    </Screen>
  );
}
