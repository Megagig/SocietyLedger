import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, Building2, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { tokens } from '@/theme/tokens';
import { ActiveVoteCard } from '@/features/home/components/ActiveVoteCard';
import { AnnouncementsList } from '@/features/home/components/AnnouncementsList';
import { AssociationRecentTransactions } from '@/features/home/components/AssociationRecentTransactions';
import { BalanceCard } from '@/features/home/components/BalanceCard';
import { MemberStatRow } from '@/features/home/components/MemberStatRow';
import { OfficerStatRow } from '@/features/home/components/OfficerStatRow';
import { PaymentMethodsChart } from '@/features/home/components/PaymentMethodsChart';
import { QuickActionsGrid } from '@/features/home/components/QuickActionsGrid';
import { RecentActivityList } from '@/features/home/components/RecentActivityList';
import { RecentPaymentsList } from '@/features/home/components/RecentPaymentsList';
import { RevenueChart } from '@/features/home/components/RevenueChart';
import { UpcomingMeetingCard } from '@/features/home/components/UpcomingMeetingCard';
import { UpcomingObligationsList } from '@/features/home/components/UpcomingObligationsList';
import { useAssociationDashboard } from '@/features/dashboard/queries';
import { useMemberFinanceSummary, useMemberPayments } from '@/features/memberFinance/queries';
import { useUpcomingMeetings } from '@/features/meetings/queries';
import { useAnnouncements } from '@/features/notifications/queries';
import { useMe } from '@/features/session/queries';
import { useActiveVoting } from '@/features/voting/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney, toDecimal } from '@/lib/money';
import { t, type TranslationKey } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useTenantStore } from '@/stores/tenant';

type DashboardTab = 'me' | 'association';

function getGreetingLabel(): string {
  const hour = new Date().getHours();
  const key: TranslationKey =
    hour < 12 ? 'home.greeting.morningLabel' : hour < 17 ? 'home.greeting.afternoonLabel' : 'home.greeting.eveningLabel';
  return t(key);
}

/**
 * project-overview.md §6.3, H1 + H2 — member view always visible, "Me | Association"
 * segmented toggle added for officers (users with `ledger.view` = FINANCE_VIEW permission).
 * Officers are also members and see their personal data on the "Me" tab.
 */
export default function HomeScreen() {
  const router = useRouter();
  const tenant = useTenantStore((state) => state.current);
  const { color } = useThemeTokens();

  const [activeTab, setActiveTab] = useState<DashboardTab>('me');

  const me = useMe(true);
  const isOfficer = useCan('FINANCE_VIEW');
  const canViewMeetings = useCan('MEETING_VIEW');
  const canViewVoting = useCan('ELECTION_VIEW');

  const summaryQuery = useMemberFinanceSummary();
  const paymentsQuery = useMemberPayments();
  const meetingsQuery = useUpcomingMeetings(1);
  const votingQuery = useActiveVoting();
  const announcementsQuery = useAnnouncements(3);
  const dashboardQuery = useAssociationDashboard(isOfficer);

  const upcomingMeetingsCount = meetingsQuery.data?.length ?? 0;

  const refreshing = [summaryQuery, paymentsQuery, announcementsQuery].some((q) => q.isRefetching)
    || (isOfficer && dashboardQuery.isRefetching);

  function handleRefresh() {
    summaryQuery.refetch();
    paymentsQuery.refetch();
    announcementsQuery.refetch();
    if (canViewMeetings) meetingsQuery.refetch();
    if (canViewVoting) votingQuery.refetch();
    if (isOfficer) dashboardQuery.refetch();
  }

  const member = me.data?.user.member;
  const displayName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();

  const showAssociation = isOfficer && activeTab === 'association';

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={handleRefresh}>
      {/* Two-line greeting */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 20 }}>
        <View style={{ flex: 1 }}>
          {displayName ? (
            <Text variant="body" tone="secondary">
              {getGreetingLabel()}
            </Text>
          ) : null}
          <Text variant="h1" numberOfLines={1} style={{ marginTop: displayName ? 2 : 0 }}>
            {displayName || t('home.greeting.plain')}
          </Text>
        </View>
        <Avatar
          name={displayName || (tenant?.name ?? '')}
          shape="circle"
          size={40}
          colorSeed={member?.id ?? tenant?.name}
        />
        <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
      </View>

      {/* Me | Association toggle — officers only */}
      {isOfficer && (
        <View style={{ marginBottom: 4 }}>
          {/* Tab switcher */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {(
              [
                { tab: 'me' as DashboardTab, label: 'My View', Icon: User },
                { tab: 'association' as DashboardTab, label: 'Association', Icon: Building2 },
              ] as const
            ).map(({ tab, label, Icon }) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: active ? color.primary : color.border,
                    backgroundColor: active ? color.primary : color.surfaceRaised,
                    opacity: pressed ? 0.82 : 1,
                    shadowColor: active ? color.primary : color.overlay,
                    shadowOffset: { width: 0, height: active ? 4 : 2 },
                    shadowRadius: active ? 10 : 4,
                    shadowOpacity: active ? 0.35 : 0.08,
                    elevation: active ? 6 : 2,
                  })}
                >
                  <Icon
                    size={18}
                    color={active ? color.textInverse : color.textSecondary}
                    strokeWidth={2}
                  />
                  <Text
                    variant="label"
                    style={{
                      color: active ? color.textInverse : color.textSecondary,
                      fontWeight: active ? '700' : '500',
                      fontSize: 14,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Current view indicator */}
          <Text variant="h2" style={{ marginBottom: 8 }}>
            {activeTab === 'me' ? 'My Dashboard' : 'Association Overview'}
          </Text>
        </View>
      )}

      {/* Content area */}
      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        {showAssociation ? (
          /* ─── Officer Association view ─── */
          <>
            <OfficerStatRow dashboardQuery={dashboardQuery} />

            <RevenueChart dashboardQuery={dashboardQuery} />

            <PaymentMethodsChart dashboardQuery={dashboardQuery} />

            {/* Quick Stats card */}
            {dashboardQuery.data && (
              <View
                style={{
                  backgroundColor: color.surfaceRaised,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: color.border,
                  padding: 16,
                  gap: 12,
                }}
              >
                <Text variant="h3">Quick Stats</Text>
                <View style={{ gap: 10 }}>
                  <QuickStatRow
                    label="Active Members"
                    value={dashboardQuery.data.quickStats.activeMembers.toString()}
                    change={dashboardQuery.data.quickStats.activeMembersChange}
                  />
                  <QuickStatRow
                    label="This Month"
                    value={formatMoney(
                      toDecimal(dashboardQuery.data.quickStats.thisMonthRevenue),
                      { compact: true },
                    )}
                    change={dashboardQuery.data.quickStats.thisMonthRevenueChange}
                  />
                  <QuickStatRow
                    label="Collection Rate"
                    value={`${dashboardQuery.data.quickStats.collectionRate}%`}
                    change={dashboardQuery.data.quickStats.collectionRateChange}
                  />
                </View>
              </View>
            )}

            <Section title="Recent Transactions">
              <AssociationRecentTransactions dashboardQuery={dashboardQuery} />
            </Section>
          </>
        ) : (
          /* ─── Member (personal) view — also shown for officers on "Me" tab ─── */
          <>
            <BalanceCard query={summaryQuery} onPay={() => router.push('/(app)/(tabs)/money' as never)} />

            <MemberStatRow summaryQuery={summaryQuery} upcomingMeetingsCount={upcomingMeetingsCount} />

            <QuickActionsGrid />

            <Section title="Recent Activity">
              <RecentActivityList summaryQuery={summaryQuery} />
            </Section>

            <Section title="Upcoming Obligations">
              <UpcomingObligationsList summaryQuery={summaryQuery} />
            </Section>

            <UpcomingMeetingCard
              query={meetingsQuery}
              canView={canViewMeetings}
              onPress={() => toast(t('home.meeting.comingSoon'))}
            />

            <ActiveVoteCard
              query={votingQuery}
              canView={canViewVoting}
              onPressElection={() => toast(t('home.vote.comingSoon'))}
              onPressPoll={() => toast(t('home.vote.comingSoon'))}
            />

            <Section title={t('home.payments.title')} onSeeAll={() => router.push('/(app)/(tabs)/money/payments' as never)}>
              <RecentPaymentsList query={paymentsQuery} onPressPayment={() => router.push('/(app)/(tabs)/money/payments' as never)} />
            </Section>

            <Section title={t('home.announcements.title')} onSeeAll={() => router.push('/(app)/notifications')}>
              <AnnouncementsList query={announcementsQuery} onPressAnnouncement={() => toast(t('home.announcements.detailComingSoon'))} />
            </Section>
          </>
        )}
      </View>
    </Screen>
  );
}

/** Inline Quick Stat row — label, value, and trend indicator. */
function QuickStatRow({ label, value, change }: { label: string; value: string; change: number }) {
  const { color } = useThemeTokens();
  const up = change >= 0;
  const changeColor = up ? color.success : color.danger;
  const changeText = `${up ? '+' : ''}${change}%`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ gap: 1 }}>
        <Text variant="caption" tone="secondary">{label}</Text>
        <Text variant="label">{value}</Text>
      </View>
      <Text variant="caption" style={{ color: changeColor }}>{changeText}</Text>
    </View>
  );
}
