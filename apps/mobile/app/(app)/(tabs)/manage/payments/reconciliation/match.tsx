import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { GroupedRow, positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCharges } from '@/features/finance/queries';
import { RECON_DECIDE_ACCESS } from '@/features/reconciliation/labels';
import { useProposeMatch } from '@/features/reconciliation/mutations';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { ChargeListItemDTO } from '@/types/api/financeManage';

const OPEN = ['pending', 'partial', 'overdue'];

/**
 * project-overview.md §6.9 PY8 — Match a line by hand: choose which charge a bank line paid. The amount is always the bank line's
 * own; a charge that owes less than the line, or is already covered, can't be chosen. Another officer confirms the match.
 */
export default function MatchLineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId: string; amount: string; description: string; date: string }>();
  const entryId = Number(params.entryId);
  const amount = Number(params.amount);
  const allowed = useCan(RECON_DECIDE_ACCESS);
  const [search, setSearch] = useState('');
  const query = useCharges({ search: search.trim() || undefined });
  const propose = useProposeMatch();
  const confirmRef = useRef<BottomSheetModal>(null);
  const [target, setTarget] = useState<ChargeListItemDTO | null>(null);
  const items = useMemo(() => (query.data?.pages.flatMap((p) => p.transactions) ?? []).filter((c) => !c.isVoided && OPEN.includes(c.status)), [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Match a line" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = () => {
    if (!target) return;
    propose.mutate(
      { transactionId: target.id, statementEntryId: entryId, matchType: 'MANUAL' },
      {
        onSuccess: () => {
          toast.success('Match proposed. Another officer confirms it.');
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not match the line. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Match a line" onBack={back} docsKey="PY8" />

      <Card>
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text variant="caption" tone="secondary">
              Money received
            </Text>
            <Money value={amount} size="h3" tone="success" />
          </View>
          <Text variant="body" numberOfLines={3}>
            {params.description}
          </Text>
          {params.date ? (
            <Text variant="caption" tone="tertiary">
              {formatDate(params.date, 'long')}
            </Text>
          ) : null}
        </View>
      </Card>

      <View className="gap-1 py-3">
        <Text variant="label">Which charge did it pay?</Text>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search a member or a charge reference" testID="match-search" />
      </View>

      <PagedList
        query={query}
        items={items}
        keyOf={(c) => String(c.id)}
        skeletonHeight={76}
        renderItem={(c: ChargeListItemDTO, i, n) => {
          const owes = Number(c.balance);
          const fits = owes >= amount;
          return (
            <GroupedRow
              position={positionOf(i, n)}
              onPress={
                fits
                  ? () => {
                      setTarget(c);
                      confirmRef.current?.present();
                    }
                  : undefined
              }
              accessibilityLabel={`${c.member.firstName} ${c.member.lastName}, ${c.category.name}, owes ${c.balance}`}
              testID={`match-charge-${c.id}`}
              minHeight={76}
            >
              <View className="gap-1">
                <View className="flex-row items-start gap-3">
                  <View className="flex-1 gap-0.5">
                    <Text variant="body-lg" numberOfLines={1}>{`${c.member.firstName} ${c.member.lastName}`}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>{`${c.category.name}${c.referenceNumber ? ` · ${c.referenceNumber}` : ''}`}</Text>
                  </View>
                  <Money value={c.balance} size="body-strong" tone={fits ? 'warning' : 'tertiary'} />
                </View>
                <Text variant="caption" tone={fits ? 'tertiary' : 'danger'} numberOfLines={1}>
                  {fits ? 'Owes this much' : `Owes less than ${formatMoney(amount)}, so this line can’t pay it`}
                </Text>
              </View>
            </GroupedRow>
          );
        }}
        empty={<EmptyState icon={Search} title="No charges found" description="Search by the member’s name, or by the reference on the charge." />}
      />

      <ConfirmSheet
        ref={confirmRef}
        title="Match this line?"
        description={target ? `${formatMoney(amount)} will be matched to ${target.member.firstName} ${target.member.lastName}’s ${target.category.name}. Nothing is recorded until another officer confirms.` : ''}
        confirmLabel="Propose this match"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() => {
          confirmRef.current?.dismiss();
          submit();
        }}
      />
    </Screen>
  );
}
