import { useRouter } from 'expo-router';
import { Lock, PiggyBank, Target, Wallet } from 'lucide-react-native';
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
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { DepositRow } from '@/features/cooperatives/components/DepositRow';
import { ACCOUNT_TYPE_LABELS } from '@/features/cooperatives/labels';
import { useCooperativeProfile, useSavingsDeposits } from '@/features/cooperatives/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatMoney, sumMoney, toDecimal } from '@/lib/money';
import { COOPERATIVE_SAVINGS_VIEW_ACCESS } from '@/lib/permissions';

/** project-overview.md §6.4 M15 — My Savings: total / held / available, accounts, and my receipt-backed deposits. */
export default function MySavingsScreen() {
  const router = useRouter();
  const canView = useCan(COOPERATIVE_SAVINGS_VIEW_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const profileQuery = useCooperativeProfile();
  const depositsQuery = useSavingsDeposits();

  if (locked) return <ModuleLockedScreen title="My Savings" moduleName="Cooperatives" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My Savings" onBack={() => router.back()} />
        <NoMemberProfile subject="savings" />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My Savings" onBack={() => router.back()} />
        <EmptyState icon={PiggyBank} title="No access" description="You don't have access to cooperative savings." />
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const deposits = depositsQuery.data?.deposits ?? [];
  const pending = deposits.filter((d) => d.status === 'PENDING');
  const held = profile ? toDecimal(profile.lockedSavings) : toDecimal(0);

  const refreshing = profileQuery.isRefetching || depositsQuery.isRefetching;
  const refresh = () => {
    profileQuery.refetch();
    depositsQuery.refetch();
  };

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="My Savings" onBack={() => router.back()} />

      {profileQuery.isPending ? (
        <View className="gap-4">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={160} radius="lg" />
        </View>
      ) : profileQuery.isError ? (
        <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
      ) : profile ? (
        <View className="gap-4 pb-6">
          <Card>
            <Text variant="caption" tone="secondary">
              Total savings
            </Text>
            <Money value={profile.totalSavings} size="h1" />
            <Text variant="caption" tone="secondary">
              {`${profile.savingsAccounts.length} account${profile.savingsAccounts.length === 1 ? '' : 's'}`}
            </Text>
            {held.greaterThan(0) ? (
              <View className="mt-3 flex-row gap-6 border-t border-border pt-3">
                <View>
                  <Text variant="caption" tone="secondary">
                    Held against your loan
                  </Text>
                  <Money value={profile.lockedSavings} />
                </View>
                <View>
                  <Text variant="caption" tone="secondary">
                    Available to you
                  </Text>
                  <Money value={profile.availableSavings} />
                </View>
              </View>
            ) : null}
          </Card>

          {held.greaterThan(0) ? (
            <Text variant="caption" tone="secondary">
              Held savings stay in your account as security for your loan and are released as you repay it.
            </Text>
          ) : null}

          {pending.length > 0 ? (
            <Text variant="caption" tone="warning">
              {`${pending.length} deposit${pending.length === 1 ? '' : 's'} (${formatMoney(sumMoney(pending.map((d) => d.amount)))}) waiting for an officer to confirm the payment.`}
            </Text>
          ) : null}

          <SectionCard title="Accounts" trailing={<Badge tone="primary">{String(profile.savingsAccounts.length)}</Badge>}>
            {profile.savingsAccounts.length === 0 ? (
              <InlineEmpty icon={PiggyBank} message="You don't have a savings account yet. Ask an officer to open one for you." />
            ) : (
              profile.savingsAccounts.map((account) => (
                <ListItem
                  key={account.id}
                  leading={<IconCircle icon={account.accountType === 'TARGET' ? Target : Wallet} tone="success" />}
                  title={ACCOUNT_TYPE_LABELS[account.accountType]}
                  meta={account.accountNumber}
                  trailing={
                    <View className="items-end gap-1">
                      <Money value={account.balance} />
                      <StatusChip status={account.status.toLowerCase()} />
                    </View>
                  }
                  showChevron
                  onPress={() => router.push(`/money/savings/${account.id}` as never)}
                />
              ))
            )}
          </SectionCard>

          <SectionCard title="My deposits" trailing={pending.length > 0 ? <Badge tone="warning">{`${pending.length} pending`}</Badge> : undefined}>
            {depositsQuery.isPending ? (
              <View className="gap-2 px-4 py-3">
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} />
              </View>
            ) : depositsQuery.isError ? (
              <ErrorState error={depositsQuery.error} onRetry={() => depositsQuery.refetch()} />
            ) : deposits.length === 0 ? (
              <InlineEmpty icon={Lock} message="No deposits yet. A deposit is added to your savings once an officer confirms your payment." />
            ) : (
              deposits.map((deposit) => <DepositRow key={deposit.id} deposit={deposit} />)
            )}
          </SectionCard>
        </View>
      ) : null}
    </Screen>
  );
}
