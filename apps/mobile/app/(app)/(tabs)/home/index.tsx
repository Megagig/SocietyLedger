import { View } from 'react-native';
import { Bell } from 'lucide-react-native';
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
import { BalanceCard } from '@/features/home/components/BalanceCard';
import { QuickActionsGrid } from '@/features/home/components/QuickActionsGrid';
import { RecentPaymentsList } from '@/features/home/components/RecentPaymentsList';
import { UpcomingMeetingCard } from '@/features/home/components/UpcomingMeetingCard';
import { useMemberFinanceSummary, useMemberPayments } from '@/features/memberFinance/queries';
import { useUpcomingMeetings } from '@/features/meetings/queries';
import { useAnnouncements } from '@/features/notifications/queries';
import { useMe } from '@/features/session/queries';
import { useActiveVoting } from '@/features/voting/queries';
import { useCan } from '@/hooks/useCan';
import { t, type TranslationKey } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

function getGreetingLabel(): string {
  const hour = new Date().getHours();
  const key: TranslationKey =
    hour < 12 ? 'home.greeting.morningLabel' : hour < 17 ? 'home.greeting.afternoonLabel' : 'home.greeting.eveningLabel';
  return t(key);
}

/**
 * project-overview.md §6.3, H1 — "Home — Me". H2 ("Home — Association", the officer
 * `Me | Association` segment) is out of scope here; it lands with the Manage-tab work that
 * needs it. Every row/card whose detail screen doesn't exist yet (C2–C10, M13, M14) opens a
 * "coming soon" toast — same established pattern as F2.1's Welcome screen and F2.5's own
 * QuickActionsGrid.
 */
export default function HomeScreen() {
  const router = useRouter();
  const tenant = useTenantStore((state) => state.current);

  const me = useMe(true);
  const canViewMeetings = useCan('MEETING_VIEW');
  const canViewVoting = useCan('ELECTION_VIEW');

  const summaryQuery = useMemberFinanceSummary();
  const paymentsQuery = useMemberPayments();
  const meetingsQuery = useUpcomingMeetings(1);
  const votingQuery = useActiveVoting();
  const announcementsQuery = useAnnouncements(3);

  const refreshing = [summaryQuery, paymentsQuery, announcementsQuery].some((q) => q.isRefetching);

  function handleRefresh() {
    summaryQuery.refetch();
    paymentsQuery.refetch();
    announcementsQuery.refetch();
    if (canViewMeetings) meetingsQuery.refetch();
    if (canViewVoting) votingQuery.refetch();
  }

  const member = me.data?.user.member;
  // Full name, since the greeting is the screen's headline. `filter(Boolean)` guards the case
  // where only one half is populated — joining blindly would leave a dangling space.
  const displayName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={handleRefresh}>
      {/* Two-line greeting: muted time-of-day label over the member's name, per the reference
       * design. Falls back to the generic title when the member record has no first name. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 20 }}>
        <View style={{ flex: 1 }}>
          {/* The time-of-day line only earns its place when there's a name under it — without
           * one it reads as "Good morning, / Welcome back". */}
          {displayName ? (
            <Text variant="body" tone="secondary">
              {getGreetingLabel()}
            </Text>
          ) : null}
          <Text variant="h1" numberOfLines={1} style={{ marginTop: displayName ? 2 : 0 }}>
            {displayName || t('home.greeting.plain')}
          </Text>
        </View>
        {/* The logged-in member, not the association: circle + their own initials, tinted from
         * their member id. The API exposes no member photo (`photoUrl` exists only on Candidate),
         * so initials are the real avatar until a Member photo field and upload flow exist. */}
        <Avatar
          name={displayName || (tenant?.name ?? '')}
          shape="circle"
          size={40}
          colorSeed={member?.id ?? tenant?.name}
        />
        <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />
      </View>

      {/* Bottom padding clears the floating tab bar — without it the last section is cut off. */}
      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        <BalanceCard query={summaryQuery} onPay={() => router.push('/(app)/(tabs)/money' as never)} />

        <QuickActionsGrid />

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
      </View>
    </Screen>
  );
}
