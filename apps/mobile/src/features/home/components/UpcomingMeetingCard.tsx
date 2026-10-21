import { Pressable, View } from 'react-native';
import { Calendar, MapPin, Video } from 'lucide-react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDate, isToday } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { UpcomingMeetingDTO } from '@/types/api/meetings';

export type UpcomingMeetingCardProps = {
  query: UseQueryResult<UpcomingMeetingDTO[], unknown>;
  canView: boolean;
  onPress: (meeting: UpcomingMeetingDTO) => void;
};

/**
 * H1's "Upcoming meeting card" — a highlight/preview of C2/C3 (Community tab, F3.4), which
 * don't exist yet. Deliberately degrades silently (returns `null`) when there's genuinely no
 * meeting or the user lacks `MEETING_VIEW` — unlike the balance card, there's no "wrong" empty
 * state to explain here, just nothing to show on this particular preview widget.
 */
export function UpcomingMeetingCard({ query, canView, onPress }: UpcomingMeetingCardProps) {
  const { color } = useThemeTokens();

  if (!canView) return null;
  if (query.isPending) return <Skeleton width="100%" height={88} radius="lg" />;
  // Silent degrade on error, matching the empty case. This is a preview of a screen the member
  // can reach another way, so a stack of "couldn't load" rows on Home costs more than it tells
  // them — the pull-to-refresh on the screen is the recovery path.
  if (query.isError) return null;

  const meeting = query.data?.[0];
  if (!meeting) return null;

  const dateLabel = isToday(meeting.startTime)
    ? t('home.meeting.today', { time: formatDate(meeting.startTime, 'time') })
    : `${formatDate(meeting.startTime, 'short')}, ${formatDate(meeting.startTime, 'time')}`;

  return (
    <Pressable onPress={() => onPress(meeting)} testID="home-upcoming-meeting">
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
            <Calendar size={20} color={color.primary} strokeWidth={1.75} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body-strong" numberOfLines={1}>
              {meeting.title}
            </Text>
            <View className="flex-row items-center gap-1">
              {meeting.virtualLink ? (
                <Video size={14} color={color.textTertiary} strokeWidth={1.75} />
              ) : (
                <MapPin size={14} color={color.textTertiary} strokeWidth={1.75} />
              )}
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {dateLabel} · {meeting.virtualLink ? t('home.meeting.online') : meeting.location ?? t('home.meeting.noLocation')}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
