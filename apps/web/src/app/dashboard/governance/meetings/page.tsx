'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMeetingStats,
  getUpcomingMeetings,
  getRecentMeetings,
  getMeetings,
  Meeting,
  MeetingStats,
  MeetingStatus,
  MeetingType,
} from '@/lib/api/meetings';
import {
  IconCalendarEvent,
  IconUsers,
  IconClipboardCheck,
  IconAlertTriangle,
  IconPlus,
  IconArrowRight,
  IconClock,
  IconMapPin,
  IconVideo,
  IconSearch,
  IconFilter,
  IconCalendar,
} from '@tabler/icons-react';

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  REGULAR: 'Regular',
  EMERGENCY: 'Emergency',
  AGM: 'AGM',
  EGM: 'EGM',
  COMMITTEE: 'Committee',
  SPECIAL: 'Special',
};

const MEETING_STATUS_COLORS: Record<MeetingStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  POSTPONED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export default function MeetingsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<MeetingType | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [searchQuery, statusFilter, typeFilter, page]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, upcomingRes, recentRes] = await Promise.all([
        getMeetingStats(),
        getUpcomingMeetings(5),
        getRecentMeetings(5),
      ]);
      setStats(statsRes.data);
      setUpcomingMeetings(upcomingRes.data || []);
      setRecentMeetings(recentRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const result = await getMeetings({
        page,
        limit: 10,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        meetingType: typeFilter || undefined,
        sortBy: 'startTime',
        sortOrder: 'desc',
      });
      setAllMeetings(result.data.meetings || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to fetch meetings:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading meetings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Meetings Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Schedule meetings, track attendance, and manage minutes
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/governance/meetings/create')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto"
        >
          <IconPlus size={20} />
          Schedule Meeting
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Meetings</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalMeetings || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">All time</p>
            </div>
            <div className="p-2 sm:p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconCalendarEvent className="text-teal-600 dark:text-teal-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Scheduled</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">
                {stats?.scheduledMeetings || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">Upcoming</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconClock className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                {stats?.completedMeetings || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">This year: {stats?.meetingsThisYear || 0}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconClipboardCheck className="text-green-600 dark:text-green-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">This Month</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">
                {stats?.meetingsThisMonth || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">Meetings held</p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <IconCalendar className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Meetings Alert */}
      {upcomingMeetings.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <IconCalendarEvent className="text-blue-600 hidden sm:block" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 text-sm sm:text-base">
                Next Meeting: {upcomingMeetings[0].title}
              </h3>
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                {formatDate(upcomingMeetings[0].startTime)} at {formatTime(upcomingMeetings[0].startTime)}
                {upcomingMeetings[0].location && ` • ${upcomingMeetings[0].location}`}
              </p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/governance/meetings/${upcomingMeetings[0].id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm w-full sm:w-auto"
            >
              View Details
            </button>
          </div>
        </div>
      )}


      {/* Quick Actions & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/governance/meetings/create')}
              className="w-full flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconPlus className="text-teal-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">Schedule New Meeting</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => router.push('/dashboard/governance/attendance')}
              className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconUsers className="text-blue-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">View Attendance History</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>

            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IconClipboardCheck className="text-green-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">View Past Meetings</span>
              </div>
              <IconArrowRight className="text-gray-400" size={16} />
            </button>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Upcoming Meetings
            </h2>
            <button
              onClick={() => setStatusFilter('SCHEDULED')}
              className="text-sm text-teal-600 hover:text-teal-800"
            >
              View All
            </button>
          </div>

          {upcomingMeetings.length > 0 ? (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => router.push(`/dashboard/governance/meetings/${meeting.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {meeting.title}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <IconClock size={14} />
                      <span>{formatDate(meeting.startTime)} • {formatTime(meeting.startTime)}</span>
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <IconMapPin size={14} />
                        <span>{meeting.location}</span>
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${MEETING_STATUS_COLORS[meeting.status]}`}>
                    {MEETING_TYPE_LABELS[meeting.meetingType]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No upcoming meetings</p>
          )}
        </div>
      </div>

      {/* All Meetings List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Meetings
          </h2>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:flex gap-3 sm:gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MeetingStatus | '')}
                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="POSTPONED">Postponed</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MeetingType | '')}
                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Types</option>
                <option value="REGULAR">Regular</option>
                <option value="EMERGENCY">Emergency</option>
                <option value="AGM">AGM</option>
                <option value="EGM">EGM</option>
                <option value="COMMITTEE">Committee</option>
                <option value="SPECIAL">Special</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {allMeetings.length > 0 ? (
            allMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="p-4 space-y-3 cursor-pointer"
                onClick={() => router.push(`/dashboard/governance/meetings/${meeting.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{meeting.title}</p>
                    {meeting.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{meeting.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${MEETING_STATUS_COLORS[meeting.status]}`}>
                    {meeting.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <IconClock size={14} />
                    {formatDate(meeting.startTime)} • {formatTime(meeting.startTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    {meeting.virtualLink ? (
                      <>
                        <IconVideo size={14} />
                        Virtual
                      </>
                    ) : meeting.location ? (
                      <>
                        <IconMapPin size={14} />
                        <span className="truncate max-w-[100px]">{meeting.location}</span>
                      </>
                    ) : (
                      'TBD'
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">
                    {MEETING_TYPE_LABELS[meeting.meetingType]} • {meeting._count?.attendances || 0} attendees
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">No meetings found</div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attendees
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {allMeetings.length > 0 ? (
                allMeetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => router.push(`/dashboard/governance/meetings/${meeting.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{meeting.title}</p>
                        {meeting.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{meeting.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>{formatDate(meeting.startTime)}</div>
                      <div>{formatTime(meeting.startTime)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        {meeting.virtualLink ? (
                          <>
                            <IconVideo size={14} />
                            <span>Virtual</span>
                          </>
                        ) : meeting.location ? (
                          <>
                            <IconMapPin size={14} />
                            <span className="truncate max-w-[150px]">{meeting.location}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">TBD</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {MEETING_TYPE_LABELS[meeting.meetingType]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${MEETING_STATUS_COLORS[meeting.status]}`}>
                        {meeting.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {meeting._count?.attendances || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No meetings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex-1 sm:flex-none px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex-1 sm:flex-none px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
