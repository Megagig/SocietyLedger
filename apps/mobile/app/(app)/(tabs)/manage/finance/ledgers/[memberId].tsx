import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ledgerManageApi } from '@/api/endpoints/ledgerManage';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { CustomRangeForm } from '@/features/ledgers/CustomRangeForm';
import { statementPresets, statementShareText } from '@/features/ledgers/labels';
import { useResyncLedger } from '@/features/ledgers/mutations';
import { LEDGERS_RESYNC_ACCESS, LEDGERS_VIEW_ACCESS, useLedgerEntries, useLedgerSummary } from '@/features/ledgers/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import type { MemberLedgerEntryDTO } from '@/types/api/memberLedger';

function EntryLine({ entry }: { entry: MemberLedgerEntryDTO }) {
  const credit = entry.entryType === 'CREDIT';
  return (
    <View className="min-h-[60px] flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={2}>
          {entry.description}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${formatDate(entry.effectiveDate, 'long')}${entry.referenceNumber ? ` · ${entry.referenceNumber}` : ''}`}
        </Text>
      </View>
      <View className="items-end">
        <Money value={entry.amount} size="body-strong" tone={credit ? 'success' : 'default'} />
        <Text variant="caption" tone="secondary">
          {credit ? 'Paid' : 'Charged'}
        </Text>
      </View>
    </View>
  );
}

/** project-overview.md §6.9 FN14 — one member's ledger: balance, charged, paid, and every entry; share a statement or rebuild the ledger. */
export default function LedgerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId: string }>();
  const memberId = Number(params.memberId);
  const canView = useCan(LEDGERS_VIEW_ACCESS);
  const canResync = useCan(LEDGERS_RESYNC_ACCESS);
  const summary = useLedgerSummary(memberId);
  const entriesQuery = useLedgerEntries(memberId);
  const resync = useResyncLedger(memberId);
  const actionsRef = useRef<BottomSheetModal>(null);
  const shareRef = useRef<BottomSheetModal>(null);
  const resyncRef = useRef<BottomSheetModal>(null);
  const [sharing, setSharing] = useState(false);
  const entries = useMemo(() => entriesQuery.data?.pages.flatMap((page) => page.entries) ?? [], [entriesQuery.data]);
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ledger" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const member = summary.data?.member;
  const name = member ? `${member.firstName} ${member.lastName}`.trim() : 'Ledger';
  const balance = Number(summary.data?.currentBalance ?? 0);

  const shareStatement = async (startDate: string, endDate: string) => {
    setSharing(true);
    try {
      const statement = await ledgerManageApi.getStatement(memberId, startDate, endDate);
      shareRef.current?.dismiss();
      await Share.share({ message: statementShareText(statement) });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not prepare the statement. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const rebuild = () =>
    resync.mutate(true, {
      onSuccess: () => {
        resyncRef.current?.dismiss();
        toast.success('Ledger rebuilt');
      },
      onError: (error) => {
        resyncRef.current?.dismiss();
        toast.error(error instanceof ApiError ? error.message : 'Could not rebuild the ledger. Try again.');
      },
    });

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title={name}
        onBack={back}
        docsKey="FN14"
        rightActions={<IconButton icon={MoreVertical} accessibilityLabel="Ledger actions" onPress={() => actionsRef.current?.present()} testID="ledger-more" />}
      />

      {summary.isPending ? (
        <Skeleton width="100%" height={72} radius="lg" />
      ) : summary.isError || !summary.data ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <View className="flex-row items-center justify-between rounded-lg bg-surface-sunken px-4 py-3" testID="ledger-summary">
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">
              {balance > 0.004 ? 'Owes' : balance < -0.004 ? 'Credit' : 'Balance'}
            </Text>
            <Money value={Math.abs(balance)} size="body-strong" tone={balance > 0.004 ? 'danger' : balance < -0.004 ? 'success' : 'default'} />
          </View>
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">
              Charged
            </Text>
            <Money value={summary.data.totalDebits} size="body-strong" />
          </View>
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">
              Paid
            </Text>
            <Money value={summary.data.totalCredits} size="body-strong" />
          </View>
        </View>
      )}

      <View className="flex-1 pt-2">
        {entriesQuery.isPending ? (
          <View className="gap-2">
            <Skeleton width="100%" height={56} radius="md" />
            <Skeleton width="100%" height={56} radius="md" />
          </View>
        ) : entriesQuery.isError ? (
          <ErrorState error={entriesQuery.error} onRetry={() => entriesQuery.refetch()} />
        ) : (
          <FlashList
            data={entries}
            keyExtractor={(entry) => String(entry.id)}
            renderItem={({ item }) => <EntryLine entry={item} />}
            ItemSeparatorComponent={Divider}
            ListEmptyComponent={
              <EmptyState
                title="No ledger entries"
                description={canResync ? 'If this member has charges or payments, rebuild the ledger from the ⋮ menu.' : 'Charges and payments appear here once they are recorded.'}
              />
            }
            ListFooterComponent={
              entriesQuery.isFetchingNextPage ? (
                <View className="items-center py-4">
                  <Spinner />
                </View>
              ) : (
                <View className="h-6" />
              )
            }
            onEndReached={() => {
              if (entriesQuery.hasNextPage && !entriesQuery.isFetchingNextPage) void entriesQuery.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            refreshing={entriesQuery.isRefetching && !entriesQuery.isFetchingNextPage}
            onRefresh={() => {
              void entriesQuery.refetch();
              void summary.refetch();
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <BottomSheet ref={actionsRef} title="Ledger actions" snapPoints={['35%']}>
        <View className="gap-3 pb-6">
          <Button
            variant="secondary"
            onPress={() => {
              actionsRef.current?.dismiss();
              shareRef.current?.present();
            }}
            testID="ledger-share"
          >
            Share statement
          </Button>
          {canResync ? (
            <Button
              variant="secondary"
              onPress={() => {
                actionsRef.current?.dismiss();
                resyncRef.current?.present();
              }}
              testID="ledger-resync"
            >
              Rebuild this ledger
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet ref={shareRef} title="Share a statement" snapPoints={['80%']}>
        <View className="gap-3 pb-6">
          <Text variant="body" tone="secondary">
            Choose the period. It opens your phone&apos;s share menu, so you can send it by WhatsApp, email or message.
          </Text>
          {statementPresets().map((preset) => (
            <Button key={preset.label} variant="secondary" loading={sharing} onPress={() => void shareStatement(preset.startDate, preset.endDate)} testID={`ledger-share-${preset.label}`}>
              {preset.label}
            </Button>
          ))}
          <CustomRangeForm loading={sharing} onShare={(startDate, endDate) => void shareStatement(startDate, endDate)} />
        </View>
      </BottomSheet>

      <ConfirmSheet
        ref={resyncRef}
        title="Rebuild this ledger?"
        description="The ledger is rebuilt from this member's charges and payments. Use it when the balance looks wrong. A charge that was voided is not counted as owed."
        confirmLabel="Rebuild ledger"
        cancelLabel="Not now"
        destructive={false}
        onConfirm={rebuild}
      />
    </Screen>
  );
}
