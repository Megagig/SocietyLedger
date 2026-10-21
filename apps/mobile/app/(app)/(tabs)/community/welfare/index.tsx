import { useRouter } from 'expo-router';
import { Coins, Heart, HandCoins } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useWelfareFunds, useWelfareProfile } from '@/features/welfare/queries';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { useCan } from '@/hooks/useCan';
import { WELFARE_VIEW_ACCESS, WELFARE_REQUEST_ACCESS } from '@/lib/permissions';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** project-overview.md §6.5 C11 — Welfare hub: my summary, contributions / payout-request entry points, eligible funds. */
export default function WelfareScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const canView = useCan(WELFARE_VIEW_ACCESS);
  const canRequest = useCan(WELFARE_REQUEST_ACCESS);

  const profileQuery = useWelfareProfile();
  const fundsQuery = useWelfareFunds();
  const locked = useModuleDisabled('welfare');
  const memberId = useMemberId();

  if (locked) return <ModuleLockedScreen title="Welfare" moduleName="Welfare" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Welfare" onBack={() => router.back()} />
        <NoMemberProfile subject="welfare records" />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('welfare.title')} onBack={() => router.back()} />
        <EmptyState icon={Heart} title="No access" description="You don't have welfare access." />
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const eligibleFunds = (fundsQuery.data?.funds ?? []).filter((f) => profile?.eligibleFunds.includes(f.id));

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={t('welfare.title')} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileQuery.isRefetching}
            onRefresh={() => {
              profileQuery.refetch();
              fundsQuery.refetch();
            }}
            tintColor={color.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {profileQuery.isPending && (
          <View className="gap-4">
            <Skeleton width="100%" height={160} radius="lg" />
            <Skeleton width="100%" height={120} radius="lg" />
          </View>
        )}

        {profileQuery.isError && <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />}

        {profile && (
          <View className="gap-4">
            <Text variant="body" tone="secondary">
              Track your welfare contributions and request support
            </Text>

            <SectionCard title="My summary">
              <ListItem
                leading={<IconCircle icon={HandCoins} tone="success" />}
                title={t('welfare.contributions')}
                meta={
                  profile.lastContributionDate
                    ? `${profile.contributionCount} contribution${profile.contributionCount === 1 ? '' : 's'} · last ${format(new Date(profile.lastContributionDate), 'd MMM yyyy')}`
                    : `${profile.contributionCount} contribution${profile.contributionCount === 1 ? '' : 's'}`
                }
                trailing={<Money value={profile.totalContributions} />}
              />
              <ListItem
                leading={<IconCircle icon={Coins} tone="info" />}
                title={t('welfare.payouts')}
                meta={`${profile.payoutCount} payout${profile.payoutCount === 1 ? '' : 's'} received`}
                trailing={<Money value={profile.totalPayoutsReceived} />}
              />
            </SectionCard>

            <SectionCard title="Manage">
              <ListItem
                leading={<IconCircle icon={HandCoins} tone="primary" />}
                title="My contributions"
                meta="Contributions you've made to welfare funds"
                showChevron
                onPress={() => router.push('/(app)/(tabs)/community/welfare/contributions' as never)}
              />
              <ListItem
                leading={<IconCircle icon={Heart} tone="accent" />}
                title="Payout requests"
                meta="Support you've requested"
                trailing={profile.pendingRequests > 0 ? <Badge tone="warning">{`${profile.pendingRequests} pending`}</Badge> : undefined}
                showChevron
                onPress={() => router.push('/(app)/(tabs)/community/welfare/requests' as never)}
              />
            </SectionCard>

            <SectionCard title="Eligible funds" trailing={<Badge tone="primary">{String(profile.eligibleFunds.length)}</Badge>}>
              {fundsQuery.isPending ? (
                <View className="gap-2 px-4 py-3">
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="40%" height={12} />
                </View>
              ) : eligibleFunds.length > 0 ? (
                eligibleFunds.map((fund) => (
                  <ListItem
                    key={fund.id}
                    leading={<IconCircle icon={Heart} tone="success" />}
                    title={fund.name}
                    meta={fund.description ?? undefined}
                  />
                ))
              ) : (
                <InlineEmpty icon={Heart} message={t('welfare.noFunds')} />
              )}
            </SectionCard>

            {canRequest && (
              <Button variant="primary" onPress={() => router.push('/(app)/(tabs)/community/welfare/request' as never)}>
                Request support
              </Button>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
