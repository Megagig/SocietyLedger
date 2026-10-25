import { useLocalSearchParams, useRouter } from 'expo-router';
import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Passbook } from '@/components/ui/Passbook';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DepositRow } from '@/features/cooperatives/components/DepositRow';
import { ACCOUNT_TYPE_LABELS, TRANSACTION_TYPE_LABELS, isCreditTransaction } from '@/features/cooperatives/labels';
import { useCooperativeProfile, useSavingsDeposits, useSavingsTransactions } from '@/features/cooperatives/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { formatMoney, toDecimal } from '@/lib/money';
import { COOPERATIVE_SAVINGS_DEPOSIT_ACCESS, COOPERATIVE_SAVINGS_VIEW_ACCESS } from '@/lib/permissions';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** project-overview.md §6.4 M16 — Savings account detail: balance, totals, my pending/declined deposits, and the transaction history. */
export default function SavingsAccountScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const canView = useCan(COOPERATIVE_SAVINGS_VIEW_ACCESS);
  const canDeposit = useCan(COOPERATIVE_SAVINGS_DEPOSIT_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const profileQuery = useCooperativeProfile();
  const transactionsQuery = useSavingsTransactions(accountId);
  const depositsQuery = useSavingsDeposits(accountId);

  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Savings account" moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings account" onBack={back} />
        <NoMemberProfile subject="savings" />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings account" onBack={back} />
        <EmptyState icon={PiggyBank} title="No access" description="You don't have access to cooperative savings." />
      </Screen>
    );
  }

  const account = profileQuery.data?.savingsAccounts.find((a) => a.id === accountId);

  if (profileQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Savings account" onBack={back} />
        <Skeleton width="100%" height={160} radius="lg" />
      </Screen>
    );
  }

  if (profileQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings account" onBack={back} />
        <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
      </Screen>
    );
  }

  // The profile only lists the caller's own accounts, so an id that isn't in it is not theirs (the API 404s it too).
  if (!account) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Savings account" onBack={back} />
        <EmptyState icon={PiggyBank} title="Account not found" description="This savings account isn't one of yours." />
      </Screen>
    );
  }

  const transactions = transactionsQuery.data?.pages.flatMap((page) => page.transactions) ?? [];
  const attention = (depositsQuery.data?.deposits ?? []).filter((d) => d.status !== 'APPROVED');
  const target = account.targetAmount ? toDecimal(account.targetAmount) : null;
  const progress = target && target.greaterThan(0) ? toDecimal(account.balance).div(target).times(100).toDecimalPlaces(0).toString() : null;

  const refresh = () => {
    profileQuery.refetch();
    transactionsQuery.refetch();
    depositsQuery.refetch();
  };

  return (
    <Screen
      edges={['top']}
      refreshing={profileQuery.isRefetching || transactionsQuery.isRefetching || depositsQuery.isRefetching}
      onRefresh={refresh}
    >
      <ScreenHeader title={ACCOUNT_TYPE_LABELS[account.accountType]} onBack={back} docsKey="M16" />

      <View className="gap-6 pb-6">
        <Passbook
          label="Current balance"
          amount={account.balance}
          metaLine={`Account ${account.accountNumber}${progress ? ` · ${progress}% of target` : ''}`}
          stampLabel={account.status}
        />

        {account.status === 'ACTIVE' && canDeposit ? (
          <Button variant="primary" onPress={() => router.push({ pathname: '/money/savings/deposit', params: { accountId: String(account.id) } } as never)}>
            Make a deposit
          </Button>
        ) : null}

        <SectionCard title="Summary">
          <ListItem
            leading={<IconCircle icon={TrendingUp} tone="success" />}
            title="Total deposits"
            trailing={<Money value={account.totalDeposits} />}
          />
          <ListItem
            leading={<IconCircle icon={TrendingDown} tone="neutral" />}
            title="Total withdrawals"
            trailing={<Money value={account.totalWithdrawals} />}
          />
          <ListItem
            leading={<IconCircle icon={PiggyBank} tone="info" />}
            title="Interest earned"
            trailing={<Money value={account.accruedInterest} />}
          />
          <ListItem title="Opened" trailing={<Text variant="body">{formatDate(account.openedAt, 'long')}</Text>} />
        </SectionCard>

        {attention.length > 0 ? (
          <SectionCard title="Deposits to this account">
            {attention.map((deposit) => (
              <DepositRow key={deposit.id} deposit={deposit} />
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title="History">
          {transactionsQuery.isPending ? (
            <View className="gap-2 px-4 py-3">
              <Skeleton width="100%" height={40} radius="md" />
              <Skeleton width="100%" height={40} radius="md" />
            </View>
          ) : transactionsQuery.isError ? (
            <ErrorState error={transactionsQuery.error} onRetry={() => transactionsQuery.refetch()} />
          ) : transactions.length === 0 ? (
            <InlineEmpty icon={PiggyBank} message="No transactions yet. Confirmed deposits will appear here." />
          ) : (
            transactions.map((tx) => {
              const credit = isCreditTransaction(tx.type);
              return (
                <ListItem
                  key={tx.id}
                  title={TRANSACTION_TYPE_LABELS[tx.type]}
                  meta={formatDate(tx.createdAt, 'long')}
                  trailing={
                    <View className="items-end gap-0.5">
                      <Text variant="body-strong" style={{ color: credit ? color.success : color.danger }}>
                        {`${credit ? '+' : '–'}${formatMoney(tx.amount)}`}
                      </Text>
                      <Money value={tx.balanceAfter} size="caption" tone="secondary" />
                    </View>
                  }
                />
              );
            })
          )}
          {transactionsQuery.hasNextPage ? (
            <View className="px-4 py-3">
              <Button variant="secondary" loading={transactionsQuery.isFetchingNextPage} onPress={() => transactionsQuery.fetchNextPage()}>
                Load more
              </Button>
            </View>
          ) : null}
        </SectionCard>
      </View>
    </Screen>
  );
}
