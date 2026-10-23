import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
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
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { chargeCanDelete, chargeCanEdit, chargeCanPay, chargeCanVoid, chargeMemberName, chargeStatusKey, chargeStatusLabel, PAYMENT_METHOD_LABELS } from '@/features/finance/labels';
import { useDeleteCharge, useUndoDeleteCharge } from '@/features/finance/mutations';
import { CHARGE_DELETE_ACCESS, CHARGE_EDIT_ACCESS, FINANCE_VIEW_ACCESS, PAYMENT_RECORD_ACCESS, useCharge } from '@/features/finance/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import type { ManualPaymentMethod } from '@/types/api/financeManage';

/** project-overview.md §6.9 FN3 — one charge: what it is, what is paid on it, and Record payment / Edit / Void & replace / Delete. */
export default function ChargeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canEdit = useCan(CHARGE_EDIT_ACCESS);
  const canDelete = useCan(CHARGE_DELETE_ACCESS);
  const canPay = useCan(PAYMENT_RECORD_ACCESS);
  const query = useCharge(id);
  const del = useDeleteCharge();
  const undo = useUndoDeleteCharge();
  const actionsRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Charge" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const charge = query.data;
  const showEdit = !!charge && canEdit && chargeCanEdit(charge);
  const showVoid = !!charge && canEdit && chargeCanVoid(charge);
  const showDelete = !!charge && canDelete && chargeCanDelete(charge);
  const showPay = !!charge && canPay && chargeCanPay(charge);
  const hasMore = showEdit || showVoid || showDelete;

  const remove = () => {
    if (!charge) return;
    del.mutate(charge.id, {
      onSuccess: ({ auditLogId }) => {
        deleteRef.current?.dismiss();
        // Undo restores the charge (it has no payments, so nothing else is lost).
        toast.success('Charge deleted', {
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () =>
              undo.mutate(auditLogId, {
                onSuccess: () => toast.success('Charge restored'),
                onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not restore the charge.'),
              }),
          },
        });
        router.back();
      },
      onError: (error) => {
        deleteRef.current?.dismiss();
        toast.error(error instanceof ApiError ? error.message : 'Could not delete the charge. Try again.');
        void query.refetch();
      },
    });
  };

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Charge"
        onBack={back}
        docsKey="FN3"
        rightActions={hasMore ? <IconButton icon={MoreVertical} accessibilityLabel="More actions" onPress={() => actionsRef.current?.present()} testID="charge-more" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !charge ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {charge.category.name}
            </Text>
            <Money value={charge.amount} size="h1" />
            <StatusChip status={chargeStatusKey(charge)} label={chargeStatusLabel(charge)} />
            {!charge.isVoided && Number(charge.totalPaid) > 0 ? (
              <Text variant="caption" tone="secondary">
                {`Paid ₦${Number(charge.totalPaid).toLocaleString('en-NG')} · ₦${Number(charge.balance).toLocaleString('en-NG')} left`}
              </Text>
            ) : null}
          </View>

          {charge.isVoided ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4" testID="charge-voided">
              <Text variant="label" tone="danger">
                Voided{charge.voidedAt ? ` on ${formatDate(charge.voidedAt, 'long')}` : ''}
              </Text>
              {charge.voidReason ? <Text variant="body">{charge.voidReason}</Text> : null}
              {charge.replacedBy ? (
                <Pressable onPress={() => go(`transactions/${charge.replacedBy}`)} accessibilityRole="button" hitSlop={8}>
                  <Text variant="label" tone="primary">
                    See the replacement
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {charge.replaces ? (
            <Pressable onPress={() => go(`transactions/${charge.replaces}`)} accessibilityRole="button" hitSlop={8}>
              <Text variant="caption" tone="secondary">
                This charge replaces a voided one — tap to see it.
              </Text>
            </Pressable>
          ) : null}

          <Section title="Details">
            <ListGroup>
              <ListItem
                title={chargeMemberName(charge)}
                meta={charge.member.memberId ?? undefined}
                showChevron
                onPress={() => router.push(`/(app)/(tabs)/manage/members/${charge.member.id}` as never)}
                testID="charge-member"
              />
              <FactRow label="Reference" value={charge.referenceNumber} />
              <FactRow label="Due date" value={charge.dueDate ? formatDate(charge.dueDate, 'long') : null} />
              <FactRow label="Created" value={`${formatDate(charge.createdAt, 'long')}${charge.creator ? ` by ${charge.creator.email}` : ''}`} />
              <FactRow label="Note" value={charge.notes} />
            </ListGroup>
          </Section>

          <Section title={charge.payments.length === 0 ? 'Payments' : `Payments · ${charge.payments.length}`}>
            {charge.payments.length === 0 ? (
              <Text variant="body" tone="secondary">
                Nothing has been paid on this charge yet.
              </Text>
            ) : (
              <ListGroup>
                {charge.payments.map((p) => (
                  <ListItem
                    key={p.id}
                    title={p.receiptNumber ?? `Payment ${p.id}`}
                    meta={`${PAYMENT_METHOD_LABELS[p.paymentMethod as ManualPaymentMethod] ?? p.paymentMethod ?? 'Method not stated'} · ${formatDate(p.paymentDate, 'long')}${p.confirmer ? ` · ${p.confirmer.email}` : ''}`}
                    trailing={<Money value={p.amountPaid} size="body-strong" />}
                  />
                ))}
              </ListGroup>
            )}
          </Section>
        </View>
      )}

      {showPay ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => go(`payments/new?transactionId=${id}`)} testID="charge-pay">
              Record payment
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <BottomSheet ref={actionsRef} title="Charge actions" snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {showEdit ? (
            <Button
              variant="secondary"
              onPress={() => {
                actionsRef.current?.dismiss();
                go(`transactions/edit?id=${id}&mode=edit`);
              }}
              testID="charge-edit"
            >
              Edit charge
            </Button>
          ) : null}
          {showVoid ? (
            <Button
              variant="secondary"
              onPress={() => {
                actionsRef.current?.dismiss();
                go(`transactions/edit?id=${id}&mode=void`);
              }}
              testID="charge-void"
            >
              Void and replace
            </Button>
          ) : null}
          {showDelete ? (
            <Button
              variant="danger"
              onPress={() => {
                actionsRef.current?.dismiss();
                deleteRef.current?.present();
              }}
              testID="charge-delete"
            >
              Delete charge
            </Button>
          ) : null}
          {showVoid ? (
            <Text variant="caption" tone="secondary">
              This charge has payments on it, so it can&apos;t be edited or deleted. Void and replace keeps the history and creates a corrected charge.
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this charge?"
        description="It disappears from the member's balance. You'll have a few seconds to undo it."
        confirmLabel="Delete charge"
        onConfirm={remove}
      />
    </Screen>
  );
}
