'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAttendanceHistory, MemberAttendanceHistory } from '@/lib/api/meetings';
import {
  IconUsers,
  IconSearch,
  IconArrowLeft,
  IconTrendingUp,
  IconTrendingDown,
} from '@tabler/icons-react';

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [attendanceHistory, setAttendanceHistory] = useState<MemberAttendanceHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<MemberAttendanceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredHistory(
        attendanceHistory.filter((h) =>
          h.memberName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredHistory(attendanceHistory);
    }
  }, [searchQuery, attendanceHistory]);

  const fetchAttendanceHistory = async () => {
    try {
      const result = await getAttendanceHistory();
      setAttendanceHistory(result.data || []);
      setFilteredHistory(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (rate >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };

  // Calculate overall stats
  const overallStats = {
    totalMembers: attendanceHistory.length,
    avgAttendanceRate: attendanceHistory.length > 0
      ? Math.round(attendanceHistory.reduce((sum, h) => sum + h.attendanceRate, 0) / attendanceHistory.length)
      : 0,
    highAttendance: attendanceHistory.filter((h) => h.attendanceRate >= 80).length,
    lowAttendance: attendanceHistory.filter((h) => h.attendanceRate < 60).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading attendance history...</div>
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
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => router.push('/dashboard/governance/meetings')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Attendance History
          </h1>
          <p className="text-sm sm:text-base text-gray-500">Track member attendance across all meetings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Members</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {overallStats.totalMembers}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <IconUsers className="text-teal-600 dark:text-teal-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Avg Attendance</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 ${getAttendanceColor(overallStats.avgAttendanceRate)}`}>
                {overallStats.avgAttendanceRate}%
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <IconTrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">High Attendance</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                {overallStats.highAttendance}
              </p>
              <p className="text-xs text-gray-500 hidden sm:block">≥80% rate</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <IconTrendingUp className="text-green-600 dark:text-green-400" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Low Attendance</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">
                {overallStats.lowAttendance}
              </p>
              <p className="text-xs text-gray-500 hidden sm:block">&lt;60% rate</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <IconTrendingDown className="text-red-600 dark:text-red-400" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative w-full sm:max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((member) => (
              <div key={member.memberId} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {member.memberName}
                  </p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttendanceBadge(member.attendanceRate)}`}>
                    {member.attendanceRate}%
                  </span>
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2">
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{member.totalMeetings}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Present</p>
                    <p className="font-semibold text-green-600 text-sm">{member.attended}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Absent</p>
                    <p className="font-semibold text-red-600 text-sm">{member.absent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Late</p>
                    <p className="font-semibold text-orange-600 text-sm">{member.late}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No members found matching your search' : 'No attendance records yet'}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Meetings
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attended
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Absent
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Apologies
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Late
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attendance Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((member) => (
                  <tr key={member.memberId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {member.memberName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {member.totalMeetings}
                    </td>
                    <td className="px-6 py-4 text-center text-green-600 font-medium">
                      {member.attended}
                    </td>
                    <td className="px-6 py-4 text-center text-red-600 font-medium">
                      {member.absent}
                    </td>
                    <td className="px-6 py-4 text-center text-yellow-600 font-medium">
                      {member.apologies}
                    </td>
                    <td className="px-6 py-4 text-center text-orange-600 font-medium">
                      {member.late}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAttendanceBadge(member.attendanceRate)}`}>
                        {member.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? 'No members found matching your search' : 'No attendance records yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
