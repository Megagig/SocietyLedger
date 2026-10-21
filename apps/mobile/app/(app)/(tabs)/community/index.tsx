import { BarChart2, Bell, CalendarDays, Heart, Lock, Megaphone, Vote, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { format } from 'date-fns';

import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useUpcomingMeetings } from '@/features/meetings/queries';
import { useActiveVoting } from '@/features/voting/queries';
import { useAnnouncements } from '@/features/notifications/queries';
import { useWelfareProfile } from '@/features/welfare/queries';
import { useCan } from '@/hooks/useCan';
import { WELFARE_VIEW_ACCESS } from '@/lib/permissions';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { t } from '@/lib/i18n';

type HubCardProps = {
  icon: LucideIcon;
  title: string;
  meta?: string;
  onPress: () => void;
};

function HubCard({ icon: Icon, title, meta, onPress }: HubCardProps) {
  const { color } = useThemeTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${color.primary}1F` }}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        <Icon size={20} color={color.primary} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-strong">{title}</Text>
        {meta ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Shown in place of a section whose module isn't in the association's plan (the API answered MODULE_DISABLED). */
function LockedCard({ moduleName }: { moduleName: string }) {
  const { color } = useThemeTokens();
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
        <Lock size={20} color={color.textTertiary} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-strong" tone="secondary">
          {moduleName} isn&apos;t in your plan
        </Text>
        <Text variant="caption" tone="tertiary">
          Your association admin can add it.
        </Text>
      </View>
    </View>
  );
}

/** project-overview.md §6.5 C1 — Community hub with section previews. */
export default function CommunityScreen() {
  const router = useRouter();

  const canMeetings = useCan('MEETING_VIEW');
  const canVoting = useCan('ELECTION_VIEW');
  const canWelfare = useCan(WELFARE_VIEW_ACCESS);
  const canPolls = useCan('POLL_VIEW');

  const meetingsOff = useModuleDisabled('meetings');
  const votingOff = useModuleDisabled('voting');
  const welfareOff = useModuleDisabled('welfare');
  const memberId = useMemberId();

  const upcomingQuery = useUpcomingMeetings(3);
  const votingQuery = useActiveVoting();
  const announcementsQuery = useAnnouncements(3);
  const welfareQuery = useWelfareProfile();

  const nextMeeting = upcomingQuery.data?.[0];
  const activeElections = votingQuery.data?.activeElections?.length ?? 0;
  const activePolls = votingQuery.data?.activePolls?.length ?? 0;
  const latestAnnouncement = announcementsQuery.data?.[0];
  const welfareProfile = welfareQuery.data;

  const go = (path: string) => router.push(path as never);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        large
        title="Community"
        rightActions={<IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => router.push('/(app)/notifications')} />}
      />

      <View className="gap-6 pb-6 pt-2">
        {/* Meetings */}
        {canMeetings && (
          <Section title="Meetings" onSeeAll={meetingsOff ? undefined : () => go('/(app)/(tabs)/community/meetings')}>
            {meetingsOff ? (
              <LockedCard moduleName="Meetings" />
            ) : upcomingQuery.isPending ? (
              <Skeleton width="100%" height={68} />
            ) : (
              <HubCard
                icon={CalendarDays}
                title={nextMeeting ? nextMeeting.title : t('meetings.empty')}
                meta={nextMeeting ? format(new Date(nextMeeting.startTime), 'EEE d MMM · h:mm a') : undefined}
                onPress={() =>
                  go(nextMeeting ? `/(app)/(tabs)/community/meetings/${nextMeeting.id}` : '/(app)/(tabs)/community/meetings')
                }
              />
            )}
          </Section>
        )}

        {/* Voting / Elections */}
        {canVoting && (
          <Section title="Voting" onSeeAll={votingOff ? undefined : () => go('/(app)/(tabs)/community/elections')}>
            {votingOff ? (
              <LockedCard moduleName="Voting" />
            ) : votingQuery.isPending ? (
              <Skeleton width="100%" height={68} />
            ) : (
              <HubCard
                icon={Vote}
                title={
                  activeElections > 0
                    ? `${activeElections} active election${activeElections > 1 ? 's' : ''}`
                    : 'No active elections'
                }
                meta={activePolls > 0 ? `${activePolls} open poll${activePolls > 1 ? 's' : ''}` : undefined}
                onPress={() => go('/(app)/(tabs)/community/elections')}
              />
            )}
          </Section>
        )}

        {/* Polls */}
        {canPolls && (
          <Section title="Polls" onSeeAll={votingOff ? undefined : () => go('/(app)/(tabs)/community/polls')}>
            {votingOff ? (
              <LockedCard moduleName="Polls" />
            ) : votingQuery.isPending ? (
              <Skeleton width="100%" height={68} />
            ) : (
              <HubCard
                icon={BarChart2}
                title={activePolls > 0 ? `${activePolls} open poll${activePolls > 1 ? 's' : ''}` : 'No open polls'}
                onPress={() => go('/(app)/(tabs)/community/polls')}
              />
            )}
          </Section>
        )}

        {/* Welfare */}
        {canWelfare && (
          <Section title="Welfare" onSeeAll={welfareOff ? undefined : () => go('/(app)/(tabs)/community/welfare')}>
            {welfareOff ? (
              <LockedCard moduleName="Welfare" />
            ) : welfareQuery.isPending && memberId !== undefined ? (
              <Skeleton width="100%" height={68} />
            ) : (
              <HubCard
                icon={Heart}
                title="Welfare fund"
                meta={
                  welfareProfile
                    ? `${welfareProfile.eligibleFunds.length} eligible fund${welfareProfile.eligibleFunds.length !== 1 ? 's' : ''}`
                    : undefined
                }
                onPress={() => go('/(app)/(tabs)/community/welfare')}
              />
            )}
          </Section>
        )}

        {/* Announcements */}
        <Section title="Announcements" onSeeAll={() => go('/(app)/(tabs)/community/announcements')}>
          {announcementsQuery.isPending ? (
            <Skeleton width="100%" height={68} />
          ) : (
            <HubCard
              icon={Megaphone}
              title={latestAnnouncement ? latestAnnouncement.title : 'No announcements'}
              meta={latestAnnouncement ? latestAnnouncement.message : undefined}
              onPress={() => go('/(app)/(tabs)/community/announcements')}
            />
          )}
        </Section>
      </View>
    </Screen>
  );
}
