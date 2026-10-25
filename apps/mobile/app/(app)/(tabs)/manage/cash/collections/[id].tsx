import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
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
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/cash/components/ReasonSheet';
import { ReceiptRow } from '@/features/cash/components/ReceiptRow';
import { COLLECTION_STATUS_LABELS } from '@/features/cash/labels';
import { useCloseCashCollection, useVoidCashReceipt } from '@/features/cash/mutations';
import { CASH_ANY_ACCESS, CASH_COLLECT_ACCESS, CASH_LODGE_ACCESS, CASH_VERIFY_ACCESS, useCashCollection } from '@/features/cash/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { useSessionStore } from '@/stores/session';
import type { CashReceiptDTO } from '@/types/api/cash';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 CA4 — one collection: what was taken, receipt by receipt, with Collect cash, Close and (for a second officer) Void. */
export default function CollectionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const canView = useCan(CASH_ANY_ACCESS);
  const canCollect = useCan(CASH_COLLECT_ACCESS);
  const canLodge = useCan(CASH_LODGE_ACCESS);
  const canVoid = useCan(CASH_VERIFY_ACCESS);
  const userId = useSessionStore((state) => state.user?.id);
  const query = useCashCollection(id);
  const close = useCloseCashCollection(id);
  const voidReceipt = useVoidCashReceipt();
  const closeSheetRef = useRef<BottomSheetModal>(null);
  const receiptSheetRef = useRef<BottomSheetModal>(null);
  const voidSheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<CashReceiptDTO | null>(null);
  const back = () => router.back();

  const collection = query.data;
  const isMine = collection !== undefined && collection.collectedBy.id === userId;
  const isOpen = collection?.status === 'OPEN';
  const receipts = useMemo(() => collection?.receipts ?? [], [collection]);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collection" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const fail = (error: unknown, fallback: string) => {
    toast.error(error instanceof ApiError ? error.message : fallback);
    void query.refetch();
  };

  const closeCollection = () =>
    close.mutate(undefined, {
      onSuccess: () => {
        closeSheetRef.current?.dismiss();
        toast.success('Collection closed');
      },
      onError: (error) => {
        closeSheetRef.current?.dismiss();
        fail(error, 'Could not close the collection. Try again.');
      },
    });

  // A second officer can void a receipt while the collection is open; the collector can't void their own.
  const canVoidReceipt = (receipt: CashReceiptDTO) => canVoid && isOpen && receipt.status === 'ACTIVE' && receipt.createdBy.id !== userId;
  const openReceipt = (receipt: CashReceiptDTO) => {
    setSelected(receipt);
    receiptSheetRef.current?.present();
  };

  const confirmVoid = (reason: string) => {
    if (!selected) return;
    voidReceipt.mutate(
      { id: selected.id, reason },
      {
        onSuccess: () => {
          voidSheetRef.current?.dismiss();
          receiptSheetRef.current?.dismiss();
          toast.success('Receipt voided');
        },
        onError: (error) => {
          voidSheetRef.current?.dismiss();
          fail(error, 'Could not void the receipt. Try again.');
        },
      },
    );
  };

  const showFooter = collection && ((isOpen && canCollect && isMine) || (!isOpen && canLodge && isMine && collection.toLodge > 0));

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Collection" onBack={back} docsKey="CA4" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={96} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !collection ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="h3" align="center">
              {collection.title}
            </Text>
            <Money value={collection.collected} size="h1" />
            <StatusChip status={collection.status.toLowerCase()} label={COLLECTION_STATUS_LABELS[collection.status]} />
            <Text variant="caption" tone="secondary">
              {`${collection.collectedBy.name} · opened ${formatDate(collection.openedAt, 'long')}`}
            </Text>
          </View>

          <Section title="Summary">
            <ListGroup>
              <FactRow label="Receipts" value={String(collection.receiptCount)} />
              <FactRow label="Collected" amount={collection.collected} />
              <FactRow label="Already lodged" amount={collection.lodged} />
              <FactRow label="Still to lodge" amount={collection.toLodge} />
              {collection.closedAt ? <FactRow label="Closed" value={formatDate(collection.closedAt, 'long')} /> : null}
            </ListGroup>
          </Section>

          {collection.notes ? (
            <Section title="Note">
              <Text variant="body" tone="secondary">
                {collection.notes}
              </Text>
            </Section>
          ) : null}

          <Section title={receipts.length === 0 ? 'Receipts' : `Receipts · ${receipts.length}`}>
            {receipts.length === 0 ? (
              <Text variant="body" tone="secondary">
                {isOpen && isMine ? 'No receipts yet. Tap Collect cash when a member hands you money.' : 'No receipts in this collection.'}
              </Text>
            ) : (
              <View>
                {receipts.map((receipt, index) => (
                  <ReceiptRow key={receipt.id} receipt={receipt} position={positionOf(index, receipts.length)} onPress={openReceipt} />
                ))}
              </View>
            )}
          </Section>

          {isOpen && isMine && canCollect && receipts.some((r) => r.status === 'ACTIVE') ? (
            <Button variant="soft" onPress={() => closeSheetRef.current?.present()} testID="collection-close">
              Close this collection
            </Button>
          ) : null}
        </View>
      )}

      {showFooter ? (
        <StickyFooter>
          <View className="flex-1">
            {isOpen ? (
              <Button variant="primary" fullWidth onPress={() => router.push(`/(app)/(tabs)/manage/cash/collect?collectionId=${id}` as never)} testID="collection-collect">
                Collect cash
              </Button>
            ) : (
              <Button variant="primary" fullWidth onPress={() => router.push('/(app)/(tabs)/manage/cash/lodge' as never)} testID="collection-lodge">
                Lodge this cash
              </Button>
            )}
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={closeSheetRef}
        title="Close this collection?"
        description="Once it is closed you can't add or void receipts in it. Then you can lodge the cash into the bank."
        confirmLabel="Close collection"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={closeCollection}
      />

      <BottomSheet ref={receiptSheetRef} title={selected?.receiptNumber ?? 'Receipt'} snapPoints={['55%']}>
        {selected ? (
          <View className="gap-4 pb-6">
            <View className="gap-1">
              <Text variant="body-strong">{selected.member.name}</Text>
              <Text variant="caption" tone="secondary">
                {`${formatDate(selected.createdAt, 'long')} · ${formatDate(selected.createdAt, 'time')} · taken by ${selected.createdBy.name}`}
              </Text>
            </View>
            <ListGroup>
              {selected.items.map((item) => (
                <FactRow key={item.id} label={item.label} amount={item.amount} />
              ))}
              <FactRow label="Total" amount={selected.total} />
            </ListGroup>
            {selected.status === 'VOIDED' ? (
              <Text variant="body" tone="danger">
                {`Voided${selected.voidReason ? `: ${selected.voidReason}` : ''}`}
              </Text>
            ) : canVoidReceipt(selected) ? (
              <Button variant="danger" onPress={() => voidSheetRef.current?.present()} testID="receipt-void">
                Void this receipt
              </Button>
            ) : (
              <Text variant="caption" tone="secondary">
                {isOpen ? 'Only another officer can void a receipt you took.' : 'Receipts in a closed collection can no longer be voided.'}
              </Text>
            )}
          </View>
        ) : null}
      </BottomSheet>

      <ReasonSheet
        ref={voidSheetRef}
        title="Void this receipt?"
        description="The member's balance goes back as it was and they are told why. Use this for a wrong member or a wrong amount."
        placeholder="For example: recorded against the wrong member"
        confirmLabel="Void receipt"
        loading={voidReceipt.isPending}
        onSubmit={confirmVoid}
        testID="void-receipt"
      />
    </Screen>
  );
}
