import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

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
import { Spinner } from '@/components/ui/Spinner';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { availabilityLine } from '@/features/coopManage/labels';
import { COOP_MODULE, COOP_SAVINGS_ACCESS, useAccount, useAccountTransactions } from '@/features/coopManage/queries';
import { ACCOUNT_TYPE_LABELS, isCreditTransaction, TRANSACTION_TYPE_LABELS } from '@/features/cooperatives/labels';
import { FactRow } from '@/features/members/components/FactRow';
import { useMemberCooperative } from '@/features/members/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 CP2 — one savings account: its balance and how much of it can leave, its history, and Record deposit / withdrawal. */
export default function SavingsAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(COOP_SAVINGS_ACCESS, COOP_MODULE);
  const query = useAccount(id);
  const history = useAccountTransactions(id);
  const account = query.data;
  const profile = useMemberCooperative(account?.memberId ?? NaN, account !== undefined);
  const transactions = useMemo(() => history.data?.pages.flatMap((p) => p.transactions) ?? [], [history.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/cooperatives/savings/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings account" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const held = profile.data ? Number(profile.data.lockedSavings) : 0;
  const available = account ? Math.max(0, Math.min(Number(account.balance), profile.data ? Number(profile.data.availableSavings) : Number(account.balance))) : 0;

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); void history.refetch(); }}>
      <ScreenHeader title="Savings account" onBack={back} docsKey="CP2" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !account ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {`${account.memberName} · ${account.accountNumber}`}
            </Text>
            <Money value={account.balance} size="h1" />
            <Text variant="caption" tone="secondary">
              {`${ACCOUNT_TYPE_LABELS[account.accountType]}${account.status === 'ACTIVE' ? '' : ` · ${account.status.toLowerCase()}`}`}
            </Text>
            {profile.data ? (
              <Text variant="caption" tone="secondary" testID="account-availability">
                {availabilityLine(available, held)}
              </Text>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <StatTile label="Paid in" value={formatMoney(account.totalDeposits)} tone="success" />
            <StatTile label="Taken out" value={formatMoney(account.totalWithdrawals)} tone="warning" />
          </View>

          <Section title="Details">
            <ListGroup>
              <FactRow label="Opened" value={formatDate(account.openedAt, 'long')} />
              <FactRow label="Interest rate" value={`${Number(account.interestRate)}% a year`} />
              <FactRow label="Savings target" amount={account.targetAmount ?? undefined} value={account.targetAmount === null ? 'None' : undefined} />
              <FactRow label="Monthly contribution" amount={account.monthlyContribution ?? undefined} value={account.monthlyContribution === null ? 'None' : undefined} />
              <FactRow label="Note" value={account.notes} />
            </ListGroup>
          </Section>

          <Section title="History">
            {history.isPending ? (
              <Skeleton width="100%" height={120} radius="md" />
            ) : transactions.length === 0 ? (
              <Text variant="body" tone="secondary">
                Nothing has been paid in or taken out yet.
              </Text>
            ) : (
              <ListGroup>
                {transactions.map((t) => (
                  <ListItem
                    key={t.id}
                    title={TRANSACTION_TYPE_LABELS[t.type]}
                    meta={`${formatDate(t.createdAt, 'long')} · balance ${formatMoney(t.balanceAfter)}${t.reference ? ` · ${t.reference}` : ''}`}
                    trailing={
                      <Text variant="body-strong" tone={isCreditTransaction(t.type) ? 'success' : 'default'}>
                        {`${isCreditTransaction(t.type) ? '+' : '−'}${formatMoney(t.amount)}`}
                      </Text>
                    }
                  />
                ))}
              </ListGroup>
            )}
            {history.hasNextPage ? (
              <View className="items-center pt-3">
                {history.isFetchingNextPage ? (
                  <Spinner />
                ) : (
                  <Button variant="ghost" size="sm" onPress={() => void history.fetchNextPage()}>
                    Show more
                  </Button>
                )}
              </View>
            ) : null}
          </Section>
        </View>
      )}

      {account && account.status === 'ACTIVE' ? (
        <StickyFooter>
          <View className="flex-1 flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => go(`record?id=${id}&type=WITHDRAWAL`)} testID="account-withdraw">
                Record withdrawal
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" fullWidth onPress={() => go(`record?id=${id}&type=DEPOSIT`)} testID="account-deposit">
                Record deposit
              </Button>
            </View>
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
