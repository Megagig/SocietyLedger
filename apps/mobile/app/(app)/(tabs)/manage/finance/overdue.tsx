import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { OverdueMemberRow } from '@/features/finance/components/OverdueMemberRow';
import { ReminderSheet } from '@/features/finance/components/ReminderSheet';
import { reminderOutcomeSummary } from '@/features/finance/labels';
import { useSendReminders } from '@/features/finance/mutations';
import { FINANCE_VIEW_ACCESS, REMINDERS_SEND_ACCESS, useReminderMembers } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { ReminderMemberDTO, ReminderScope } from '@/types/api/financeManage';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 FN12 — members who owe, biggest balance first; tick them and send a reminder, or call. */
export default function OverdueScreen() {
  const router = useRouter();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canSend = useCan(REMINDERS_SEND_ACCESS);
  const [scope, setScope] = useState<ReminderScope>('overdue');
  const [picked, setPicked] = useState<number[]>([]);
  const query = useReminderMembers(scope);
  const send = useSendReminders();
  const sheetRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Overdue" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const members: ReminderMemberDTO[] = query.data?.members ?? [];
  const summary = query.data?.summary;
  // Only members still on the list can be ticked (a refresh may have removed some).
  const chosen = members.filter((m) => picked.includes(m.member.id));
  const allTicked = members.length > 0 && chosen.length === members.length;
  const toggle = (id: number) => setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const submit = (message: string | undefined) => {
    const transactionIds = chosen.flatMap((m) => m.transactions.map((t) => t.id));
    send.mutate(
      { transactionIds, message },
      {
        onSuccess: (result) => {
          sheetRef.current?.dismiss();
          setPicked([]);
          if (result.sent > 0) toast.success(reminderOutcomeSummary(result));
          else toast(reminderOutcomeSummary(result));
        },
        onError: (error) => {
          sheetRef.current?.dismiss();
          toast.error(error instanceof ApiError ? error.message : 'Could not send the reminders. Try again.');
        },
      },
    );
  };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Overdue"
        onBack={back}
        docsKey="FN12"
        rightActions={
          canSend && members.length > 0 ? (
            <Button variant="ghost" size="sm" onPress={() => setPicked(allTicked ? [] : members.map((m) => m.member.id))} testID="overdue-select-all">
              {allTicked ? 'Clear' : 'Select all'}
            </Button>
          ) : undefined
        }
      />

      <View className="gap-3 pb-3">
        <SegmentedControl<ReminderScope>
          options={[
            { label: 'Overdue', value: 'overdue' },
            { label: 'All unpaid', value: 'all' },
          ]}
          value={scope}
          onChange={(value) => {
            setScope(value);
            setPicked([]);
          }}
          testID="overdue-scope"
        />
        {summary ? (
          <View className="flex-row gap-2">
            <StatTile label="Members" value={String(summary.totalMembers)} tone="primary" />
            <StatTile label="Owed" value={formatMoney(summary.totalOutstanding)} tone="warning" />
            <StatTile label="Overdue charges" value={String(summary.overdueTransactions)} tone="info" />
          </View>
        ) : null}
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={76} radius="md" />
          <Skeleton width="100%" height={76} radius="md" />
          <Skeleton width="100%" height={76} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={members}
          extraData={picked}
          keyExtractor={(entry) => String(entry.member.id)}
          renderItem={({ item, index }) => (
            <OverdueMemberRow entry={item} selected={picked.includes(item.member.id)} selectable={canSend} position={positionOf(index, members.length)} onToggle={toggle} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={BellRing}
              title={scope === 'overdue' ? 'Nobody is overdue' : 'Nobody owes anything'}
              description={scope === 'overdue' ? 'Members who miss a due date show up here.' : 'Every charge has been paid.'}
            />
          }
          ListFooterComponent={<View className="h-24" />}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}

      {canSend && chosen.length > 0 ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => sheetRef.current?.present()} testID="overdue-remind">
              {`Remind ${chosen.length} ${chosen.length === 1 ? 'member' : 'members'}`}
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ReminderSheet ref={sheetRef} memberCount={chosen.length} loading={send.isPending} onSend={submit} />
    </Screen>
  );
}
