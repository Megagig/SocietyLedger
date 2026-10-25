import type { UseQueryResult } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { NotificationDTO } from '@/types/api/notifications';
import { InlineErrorRow } from './InlineErrorRow';

export type AnnouncementsListProps = {
  query: UseQueryResult<NotificationDTO[], unknown>;
  onPressAnnouncement: (announcement: NotificationDTO) => void;
};

/** H1's "Latest announcements (3)" — `useAnnouncements`'s own finding: `GET /notifications`
 * has no `type` filter, so the query already filters to `type === 'announcement'` client-side.
 * Unlike `UpcomingMeetingCard`/`ActiveVoteCard`, this has no permission gate (every member can
 * see announcements) and shows a real empty state rather than degrading silently, since "no
 * announcements yet" is a normal, expected state worth confirming to the member. */
export function AnnouncementsList({ query, onPressAnnouncement }: AnnouncementsListProps) {
  const { color } = useThemeTokens();

  if (query.isPending) {
    return <Skeleton width="100%" height={56} radius="md" />;
  }

  if (query.isError) {
    return <InlineErrorRow title={t('home.announcements.errorTitle')} onRetry={() => query.refetch()} />;
  }

  const announcements = query.data ?? [];
  if (announcements.length === 0) {
    return (
      <EmptyState icon={Megaphone} title={t('home.announcements.emptyTitle')} description={t('home.announcements.emptyDescription')} />
    );
  }

  return (
    <ListGroup testID="home-announcements">
      {announcements.map((announcement) => (
        <ListItem
          key={announcement.id}
          leading={
            <Megaphone
              size={18}
              color={announcement.isRead ? color.textTertiary : color.primary}
              strokeWidth={1.75}
            />
          }
          title={announcement.title}
          meta={formatDate(announcement.createdAt, 'short')}
          onPress={() => onPressAnnouncement(announcement)}
        />
      ))}
    </ListGroup>
  );
}
