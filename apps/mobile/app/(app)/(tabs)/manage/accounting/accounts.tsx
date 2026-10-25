import { useRouter } from 'expo-router';
import { ListTree, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AccountRow } from '@/features/accounting/components/Rows';
import { ACCOUNT_TYPE_HINTS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER, ACCOUNTING_CREATE_ACCESS, ledgerHref } from '@/features/accounting/labels';
import { useInitializeChart } from '@/features/accounting/mutations';
import { useAccountingAccess, useAccounts } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { useCan } from '@/hooks/useCan';
import type { ChartAccountDTO } from '@/types/api/accounting';

/** How deep an account sits under its parents (0 for a top-level account). */
function depthOf(account: ChartAccountDTO, byId: Map<number, ChartAccountDTO>): number {
  let depth = 0;
  let cursor = account.parentId;
  while (cursor && depth < 6) {
    depth += 1;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return depth;
}

/** project-overview.md §6.9 AC2 — every account the books use, grouped by kind, with what each holds. Starts the standard chart when empty. */
export default function ChartOfAccountsScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const canCreate = useCan(ACCOUNTING_CREATE_ACCESS);
  const query = useAccounts(true);
  const init = useInitializeChart();
  const back = () => router.back();
  const open = (id?: number) => router.push((id ? `/(app)/(tabs)/manage/accounting/account-form?id=${id}` : '/(app)/(tabs)/manage/accounting/account-form') as never);

  const accounts = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const groups = useMemo(
    () => ACCOUNT_TYPE_ORDER.map((type) => ({ type, items: accounts.filter((a) => a.type === type) })).filter((g) => g.items.length > 0),
    [accounts],
  );

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Chart of accounts" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const start = () =>
    init.mutate(undefined, {
      onSuccess: () => toast.success('The standard accounts are ready'),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not set up the accounts. Try again.'),
    });

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Chart of accounts"
        onBack={back}
        docsKey="AC2"
        rightActions={canCreate && accounts.length > 0 ? <IconButton icon={Plus} accessibilityLabel="Add an account" onPress={() => open()} testID="accounts-new" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={60} radius="md" />
          <Skeleton width="100%" height={60} radius="md" />
          <Skeleton width="100%" height={60} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="No accounts yet"
          description="The standard chart has the accounts most associations need: bank and cash, dues and levies income, and common spending."
          actionLabel={canCreate ? 'Set up the standard accounts' : undefined}
          onAction={canCreate ? start : undefined}
        />
      ) : (
        <View className="gap-6 pb-8">
          {groups.map((group) => (
            <Section key={group.type} title={ACCOUNT_TYPE_LABELS[group.type]}>
              <Text variant="caption" tone="secondary">
                {ACCOUNT_TYPE_HINTS[group.type]} Tap an account to see every entry behind its balance.
              </Text>
              <View>
                {group.items.map((account, i) => (
                  <AccountRow
                    key={account.id}
                    item={account}
                    position={positionOf(i, group.items.length)}
                    indent={depthOf(account, byId) * 12}
                    onPress={(a) => router.push(ledgerHref({ accountId: a.id, title: a.name }) as never)}
                  />
                ))}
              </View>
            </Section>
          ))}
        </View>
      )}
    </Screen>
  );
}
