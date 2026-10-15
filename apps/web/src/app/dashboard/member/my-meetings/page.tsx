'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { IconCalendarEvent, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react';
import { getUpcomingMeetings, getAttendanceHistory } from '@/lib/api/meetings';
import { membersApi } from '@/lib/api/members';

// R2.7/G19: this page was a static placeholder — no fetch of any kind.
// /meetings/upcoming and /meetings/attendance-history already existed.
export default function MyMeetingsPage() {
  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => membersApi.getMe(),
  });

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-meetings'],
    queryFn: () => getUpcomingMeetings(10),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['my-attendance-history', meData?.id],
    queryFn: () => getAttendanceHistory(meData!.id),
    enabled: !!meData?.id,
  });

  const upcoming = upcomingData?.data || [];
  const myHistory = historyData?.data?.[0];

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Meetings
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View upcoming meetings and your attendance history
        </p>
      </div>

      <div className="space-y-6">
        {/* Upcoming Meetings */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Upcoming Meetings
          </h2>
          {upcomingLoading ? (
            <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ) : upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((meeting: any) => (
                <Link
                  key={meeting.id}
                  href={`/dashboard/governance/meetings/${meeting.id}`}
                  className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{meeting.title}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><IconCalendarEvent size={14} /> {formatDate(meeting.startTime)}</span>
                    <span className="flex items-center gap-1"><IconClock size={14} /> {formatTime(meeting.startTime)}</span>
                    {meeting.location && (
                      <span className="flex items-center gap-1"><IconMapPin size={14} /> {meeting.location}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconCalendarEvent size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No upcoming meetings scheduled
              </p>
            </div>
          )}
        </div>

        {/* Attendance Stats */}
        {historyLoading ? (
          <div className="animate-pulse h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Meetings"
              value={String(myHistory?.totalMeetings ?? 0)}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-50 dark:bg-blue-900/20"
            />
            <StatCard
              title="Attended"
              value={String(myHistory?.attended ?? 0)}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <StatCard
              title="Attendance Rate"
              value={`${myHistory?.attendanceRate ?? 0}%`}
              color="text-purple-600 dark:text-purple-400"
              bgColor="bg-purple-50 dark:bg-purple-900/20"
            />
          </div>
        )}

        {!historyLoading && !myHistory && (
          <div className="glass rounded-2xl p-6 shadow-xl text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconUsers size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No attendance records yet
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value, color, bgColor }: {
  title: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`p-6 rounded-xl ${bgColor}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
