'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getMeeting,
  updateMeeting,
  cancelMeeting,
  initializeAttendance,
  markAttendance,
  bulkMarkAttendance,
  createMinutes,
  updateMinutes,
  approveMinutes,
  Meeting,
  Attendance,
  AttendanceStatus,
} from '@/lib/api/meetings';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconVideo,
  IconUsers,
  IconClipboardCheck,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconFileText,
  IconPlus,
} from '@tabler/icons-react';

const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Present', color: 'bg-green-100 text-green-700' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-100 text-red-700' },
  { value: 'APOLOGY', label: 'Apology', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'LATE', label: 'Late', color: 'bg-orange-100 text-orange-700' },
  { value: 'PENDING', label: 'Pending', color: 'bg-gray-100 text-gray-700' },
];

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = parseInt(params.id as string);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'attendance' | 'minutes'>('details');
  
  // Attendance state
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  
  // Minutes state
  const [minutesContent, setMinutesContent] = useState('');
  const [minutesDecisions, setMinutesDecisions] = useState('');
  const [minutesActionItems, setMinutesActionItems] = useState('');
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);
  
  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchMeeting();
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const result = await getMeeting(meetingId);
      setMeeting(result.data);
      setAttendanceList(result.data.attendances || []);
      
      if (result.data.minutes) {
        setMinutesContent(result.data.minutes.content || '');
        setMinutesDecisions(result.data.minutes.decisions || '');
        setMinutesActionItems(result.data.minutes.actionItems || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeAttendance = async () => {
    try {
      setIsMarkingAttendance(true);
      await initializeAttendance(meetingId);
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  const handleMarkAttendance = async (memberId: number, status: AttendanceStatus) => {
    try {
      await markAttendance(meetingId, { memberId, status });
      setAttendanceList((prev) =>
        prev.map((a) => (a.memberId === memberId ? { ...a, status } : a))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMarkAllPresent = async () => {
    try {
      setIsMarkingAttendance(true);
      const attendances = attendanceList
        .filter((a) => a.status === 'PENDING')
        .map((a) => ({ memberId: a.memberId, status: 'PRESENT' as AttendanceStatus }));
      
      if (attendances.length > 0) {
        await bulkMarkAttendance(meetingId, attendances);
        await fetchMeeting();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  const handleSaveMinutes = async () => {
    try {
      setIsSavingMinutes(true);
      if (meeting?.minutes) {
        await updateMinutes(meetingId, {
          content: minutesContent,
          decisions: minutesDecisions,
          actionItems: minutesActionItems,
        });
      } else {
        await createMinutes(meetingId, {
          content: minutesContent,
          decisions: minutesDecisions,
          actionItems: minutesActionItems,
        });
      }
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingMinutes(false);
    }
  };

  const handleApproveMinutes = async () => {
    try {
      await approveMinutes(meetingId);
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelMeeting = async () => {
    try {
      await cancelMeeting(meetingId, cancelReason);
      setShowCancelModal(false);
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompleteMeeting = async () => {
    try {
      await updateMeeting(meetingId, { status: 'COMPLETED' });
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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
        <div className="text-gray-600 dark:text-gray-400">Loading meeting...</div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-red-600 mb-4">{error || 'Meeting not found'}</div>
        <button
          onClick={() => router.back()}
          className="text-teal-600 hover:text-teal-800"
        >
          Go Back
        </button>
      </div>
    );
  }

  const stats = meeting.attendanceStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <IconArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {meeting.title}
          </h1>
          <p className="text-gray-500">
            {meeting.meetingType} Meeting • Created by {meeting.creator?.email}
          </p>
        </div>
        <div className="flex gap-2">
          {meeting.status === 'SCHEDULED' && (
            <>
              <button
                onClick={() => router.push(`/dashboard/governance/meetings/${meetingId}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <IconEdit size={18} />
                Edit
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                <IconX size={18} />
                Cancel
              </button>
            </>
          )}
          {meeting.status === 'IN_PROGRESS' && (
            <button
              onClick={handleCompleteMeeting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <IconCheck size={18} />
              Complete Meeting
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          meeting.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
          meeting.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
          meeting.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700' :
          meeting.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {meeting.status.replace('_', ' ')}
        </span>
        {meeting.status === 'CANCELLED' && meeting.cancellationReason && (
          <span className="text-sm text-gray-500">
            Reason: {meeting.cancellationReason}
          </span>
        )}
      </div>


      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {['details', 'attendance', 'minutes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meeting Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Meeting Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <IconCalendarEvent className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Date</p>
                  <p className="text-gray-500">{formatDate(meeting.startTime)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IconClock className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Time</p>
                  <p className="text-gray-500">
                    {formatTime(meeting.startTime)}
                    {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
                  </p>
                </div>
              </div>
              {meeting.location && (
                <div className="flex items-start gap-3">
                  <IconMapPin className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Location</p>
                    <p className="text-gray-500">{meeting.location}</p>
                  </div>
                </div>
              )}
              {meeting.virtualLink && (
                <div className="flex items-start gap-3">
                  <IconVideo className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Virtual Link</p>
                    <a
                      href={meeting.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline"
                    >
                      Join Meeting
                    </a>
                  </div>
                </div>
              )}
              {meeting.quorumRequired && (
                <div className="flex items-start gap-3">
                  <IconUsers className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Quorum Required</p>
                    <p className="text-gray-500">{meeting.quorumRequired} members</p>
                  </div>
                </div>
              )}
              {meeting.description && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">Description</p>
                  <p className="text-gray-500 whitespace-pre-wrap">{meeting.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Agenda */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Agenda
            </h2>
            {meeting.agendaItems && meeting.agendaItems.length > 0 ? (
              <div className="space-y-3">
                {meeting.agendaItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          {item.duration && <span>{item.duration} min</span>}
                          {item.presenter && <span>Presenter: {item.presenter}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No agenda items</p>
            )}
          </div>

          {/* Attendance Summary */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Attendance Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                  <p className="text-sm text-gray-500">Present</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                  <p className="text-sm text-gray-500">Absent</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.apology}</p>
                  <p className="text-sm text-gray-500">Apology</p>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
                  <p className="text-sm text-gray-500">Late</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
                  <p className="text-sm text-gray-500">Pending</p>
                </div>
              </div>
              {meeting.quorumRequired && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  stats.quorumMet
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700'
                }`}>
                  {stats.quorumMet ? (
                    <>
                      <IconCheck size={20} />
                      <span>Quorum met ({stats.present + stats.late} of {meeting.quorumRequired} required)</span>
                    </>
                  ) : (
                    <>
                      <IconAlertCircle size={20} />
                      <span>Quorum not met ({stats.present + stats.late} of {meeting.quorumRequired} required)</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Attendance List
            </h2>
            <div className="flex gap-2">
              {attendanceList.length === 0 && (
                <button
                  onClick={handleInitializeAttendance}
                  disabled={isMarkingAttendance}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <IconPlus size={18} />
                  Initialize Attendance
                </button>
              )}
              {attendanceList.some((a) => a.status === 'PENDING') && (
                <button
                  onClick={handleMarkAllPresent}
                  disabled={isMarkingAttendance}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <IconCheck size={18} />
                  Mark All Present
                </button>
              )}
            </div>
          </div>

          {attendanceList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Check-in Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {attendanceList.map((attendance) => (
                    <tr key={attendance.id}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {attendance.member?.firstName} {attendance.member?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{attendance.member?.memberId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={attendance.status}
                          onChange={(e) => handleMarkAttendance(attendance.memberId, e.target.value as AttendanceStatus)}
                          className={`px-3 py-1 rounded-full text-sm font-medium border-0 ${
                            ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === attendance.status)?.color
                          }`}
                        >
                          {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {attendance.checkInTime
                          ? new Date(attendance.checkInTime).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {attendance.apologyReason || attendance.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <IconUsers size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No attendance records yet</p>
              <p className="text-sm mt-2">Click "Initialize Attendance" to create records for all members</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'minutes' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Meeting Minutes
            </h2>
            {meeting.minutes?.approvedAt && (
              <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                <IconCheck size={16} />
                Approved
              </span>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minutes Content
              </label>
              <textarea
                value={minutesContent}
                onChange={(e) => setMinutesContent(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="Record the meeting minutes here..."
                disabled={!!meeting.minutes?.approvedAt}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Key Decisions
              </label>
              <textarea
                value={minutesDecisions}
                onChange={(e) => setMinutesDecisions(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="List key decisions made during the meeting..."
                disabled={!!meeting.minutes?.approvedAt}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action Items
              </label>
              <textarea
                value={minutesActionItems}
                onChange={(e) => setMinutesActionItems(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                placeholder="List action items and responsible persons..."
                disabled={!!meeting.minutes?.approvedAt}
              />
            </div>

            {!meeting.minutes?.approvedAt && (
              <div className="flex gap-4">
                <button
                  onClick={handleSaveMinutes}
                  disabled={isSavingMinutes || !minutesContent}
                  className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <IconFileText size={18} />
                  {isSavingMinutes ? 'Saving...' : 'Save Minutes'}
                </button>
                {meeting.minutes && !meeting.minutes.approvedAt && (
                  <button
                    onClick={handleApproveMinutes}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <IconCheck size={18} />
                    Approve Minutes
                  </button>
                )}
              </div>
            )}

            {meeting.minutes && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                <p>Recorded by: {meeting.minutes.recorder?.email}</p>
                {meeting.minutes.approvedAt && (
                  <p>Approved by: {meeting.minutes.approver?.email} on {formatDate(meeting.minutes.approvedAt)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cancel Meeting
            </h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to cancel this meeting? This action cannot be undone.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Reason for cancellation..."
            />
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Keep Meeting
              </button>
              <button
                onClick={handleCancelMeeting}
                disabled={!cancelReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Cancel Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
