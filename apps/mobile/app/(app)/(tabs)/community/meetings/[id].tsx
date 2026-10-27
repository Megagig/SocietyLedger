import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, ExternalLink, MapPin, Video } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { format } from 'date-fns';
import { toast } from 'sonner-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { useMeetingDetail } from '@/features/meetings/queries';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useSessionStore } from '@/stores/session';

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: t('meetings.statusScheduled'),
    COMPLETED: t('meetings.statusCompleted'),
    CANCELLED: t('meetings.statusCancelled'),
    IN_PROGRESS: t('meetings.statusInProgress'),
    POSTPONED: t('meetings.statusPostponed'),
  };
  return map[status] ?? status;
}

async function addToCalendar(title: string, startISO: string, endISO: string | null, location: string | null) {
  try {
    const Calendar = await import('expo-calendar');
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      toast.error(t('meetings.calendarDenied'));
      return;
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCal = calendars.find((c) => c.allowsModifications) ?? calendars[0];
    if (!defaultCal) {
      toast.error('No writable calendar found.');
      return;
    }
    const start = new Date(startISO);
    const end = endISO ? new Date(endISO) : new Date(start.getTime() + 60 * 60 * 1000);
    await Calendar.createEventAsync(defaultCal.id, {
      title,
      startDate: start,
      endDate: end,
      location: location ?? undefined,
      notes: `SocietyLedger meeting: ${title}`,
    });
    toast.success(t('meetings.addedToCalendar'));
  } catch {
    toast.error('Calendar not available on this device.');
  }
}

/** project-overview.md §6.5 C3/C4 — Meeting detail: agenda, minutes, attendance stats, actions. */
export default function MeetingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const meetingId = id ? Number(id) : undefined;
  const { color } = useThemeTokens();

  const query = useMeetingDetail(meetingId);
  const meeting = query.data;
  const myMemberId = useSessionStore((s) => s.user?.member?.id);

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <View className="gap-4">
          <Skeleton width="80%" height={28} />
          <Skeleton width="60%" height={16} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !meeting) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const isOnline = !!meeting.virtualLink && !meeting.location;
  const isUpcoming = meeting.status === 'SCHEDULED' || meeting.status === 'IN_PROGRESS';
  const myAttendance = meeting.attendances.find((a) => a.memberId === myMemberId);

  return (
    <Screen edges={['top', 'bottom']} scroll>
      <ScreenHeader title={t('meetings.title')} onBack={() => router.back()} />

      <View className="gap-6">
        {/* Hero */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${color.primary}1A` }}
            >
              <Text variant="caption" style={{ color: color.primary }}>
                {statusLabel(meeting.status)}
              </Text>
            </View>
            <View
              className="rounded-full px-2.5 py-1 bg-surface-raised"
            >
              <Text variant="caption" tone="secondary">
                {meeting.meetingType}
              </Text>
            </View>
          </View>
          <Text variant="h2">{meeting.title}</Text>
          {meeting.description ? (
            <Text variant="body" tone="secondary">{meeting.description}</Text>
          ) : null}
        </View>

        {/* Time and location */}
        <Section title="Details">
          <ListGroup>
            <ListItem
              leading={<CalendarPlus size={20} color={color.textSecondary} strokeWidth={1.75} />}
              title={format(new Date(meeting.startTime), 'EEE, d MMM yyyy · h:mm a')}
              meta={meeting.endTime ? `Ends ${format(new Date(meeting.endTime), 'h:mm a')}` : undefined}
            />
            {isOnline ? (
              <ListItem
                leading={<Video size={20} color={color.textSecondary} strokeWidth={1.75} />}
                title={t('meetings.joinOnline')}
                showChevron
                onPress={() => meeting.virtualLink && Linking.openURL(meeting.virtualLink).catch(() => {})}
                trailing={<ExternalLink size={16} color={color.textTertiary} strokeWidth={1.75} />}
              />
            ) : meeting.location ? (
              <ListItem
                leading={<MapPin size={20} color={color.textSecondary} strokeWidth={1.75} />}
                title={meeting.location}
                showChevron
                onPress={() => {
                  const q = encodeURIComponent(meeting.location!);
                  Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
                }}
              />
            ) : null}
          </ListGroup>
        </Section>

        {/* Actions */}
        {isUpcoming && (
          <View className="gap-2">
            <Button
              variant="secondary"
              onPress={() => addToCalendar(meeting.title, meeting.startTime, meeting.endTime, meeting.location)}
            >
              {t('meetings.addToCalendar')}
            </Button>
            {meeting.virtualLink && (
              <Button
                variant="primary"
                onPress={() => Linking.openURL(meeting.virtualLink!).catch(() => {})}
              >
                {t('meetings.joinOnline')}
              </Button>
            )}
          </View>
        )}

        {/* Agenda */}
        {meeting.agendaItems.length > 0 && (
          <Section title={t('meetings.agendaSection')}>
            <View className="gap-2">
              {meeting.agendaItems.map((item) => (
                <View
                  key={item.id}
                  className="flex-row gap-3 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <Text variant="caption" tone="tertiary" className="w-6 text-center mt-0.5">
                    {item.orderNumber}
                  </Text>
                  <View className="flex-1 gap-0.5">
                    <Text variant="body-strong">{item.title}</Text>
                    {item.description ? (
                      <Text variant="caption" tone="secondary">{item.description}</Text>
                    ) : null}
                    {item.duration ? (
                      <Text variant="micro" tone="tertiary">{item.duration} min</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* My attendance (C3) — only the caller's own record is ever returned to non-officers */}
        {myAttendance && myAttendance.status !== 'PENDING' ? (
          <Section title="My attendance">
            <ListGroup>
              <ListItem
                title={format(new Date(meeting.startTime), 'EEE, d MMM yyyy')}
                meta={
                  myAttendance.status === 'APOLOGY' && myAttendance.apologyReason
                    ? myAttendance.apologyReason
                    : myAttendance.checkInTime
                      ? `Checked in ${format(new Date(myAttendance.checkInTime), 'h:mm a')}`
                      : undefined
                }
                trailing={
                  <StatusChip
                    status={myAttendance.status.toLowerCase()}
                    label={myAttendance.status.charAt(0) + myAttendance.status.slice(1).toLowerCase()}
                  />
                }
                showChevron
                onPress={() => router.push('/(app)/(tabs)/community/meetings/attendance' as never)}
              />
            </ListGroup>
          </Section>
        ) : null}

        {/* Attendance stats (completed meetings) */}
        {meeting.status === 'COMPLETED' && (
          <Section title={t('meetings.attendanceSection')}>
            <View className="flex-row flex-wrap gap-3">
              {[
                { label: 'Present', value: meeting.attendanceStats.present },
                { label: 'Absent', value: meeting.attendanceStats.absent },
                { label: 'Apology', value: meeting.attendanceStats.apology },
                { label: 'Pending', value: meeting.attendanceStats.pending },
              ].map(({ label, value }) => (
                <View
                  key={label}
                  className="flex-1 min-w-[80px] items-center rounded-xl border border-border bg-surface py-3 gap-1"
                >
                  <Text variant="h3">{value}</Text>
                  <Text variant="micro" tone="secondary">{label}</Text>
                </View>
              ))}
            </View>
            {meeting.attendanceStats.quorumMet !== undefined && (
              <Text variant="caption" tone={meeting.attendanceStats.quorumMet ? 'success' : 'danger'} className="text-center">
                {meeting.attendanceStats.quorumMet ? 'Quorum met' : 'Quorum not met'}
              </Text>
            )}
          </Section>
        )}

        {/* Minutes */}
        {meeting.minutes && (
          <Section title={t('meetings.minutesSection')}>
            <View className="rounded-xl border border-border bg-surface p-4 gap-3">
              <Text variant="body">{meeting.minutes.content}</Text>
              {meeting.minutes.decisions ? (
                <View className="gap-1">
                  <Text variant="label">Decisions</Text>
                  <Text variant="body" tone="secondary">{meeting.minutes.decisions}</Text>
                </View>
              ) : null}
              {meeting.minutes.actionItems ? (
                <View className="gap-1">
                  <Text variant="label">Action items</Text>
                  <Text variant="body" tone="secondary">{meeting.minutes.actionItems}</Text>
                </View>
              ) : null}
            </View>
          </Section>
        )}
      </View>
    </Screen>
  );
}
