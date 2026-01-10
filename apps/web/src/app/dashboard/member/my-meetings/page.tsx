'use client';

import { IconCalendarEvent, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react';

export default function MyMeetingsPage() {
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
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCalendarEvent size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No upcoming meetings scheduled
            </p>
          </div>
        </div>

        {/* My Attendance History */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            My Attendance History
          </h2>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconUsers size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No attendance records yet
            </p>
          </div>
        </div>

        {/* Attendance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Meetings"
            value="0"
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            title="Attended"
            value="0"
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <StatCard
            title="Attendance Rate"
            value="0%"
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>
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
