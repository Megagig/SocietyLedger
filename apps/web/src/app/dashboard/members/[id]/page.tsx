'use client';

import { PersonCircles } from '@/components/ajo/PersonCircles';
import { useAjoNav } from '@/lib/ajo/useAjoNav';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Calendar, CalendarCheck, FileText, Heart, MessageCircle, User, DollarSign, PiggyBank } from 'lucide-react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { mailHref, telHref, whatsappHref } from '@/lib/contact';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { MemberAvatar } from '@/components/members/MemberAvatar';
import { ProfilePhotoEditor } from '@/components/members/ProfilePhotoEditor';
import { apiGet, apiDelete, apiPatch } from '@/utils/api';
import { toast } from '@/lib/toast';

interface MemberDetails {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  occupation: string | null;
  category: string;
  status: string;
  joinDate: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  notes: string | null;
  loginStatus?: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  financialSummary?: {
    totalDues: number;
    totalPaid: number;
    balance: number;
  };
}

interface AttendanceTotals {
  totalMeetings: number;
  attended: number;
  absent: number;
  apologies: number;
  late: number;
  attendanceRate: number;
}

interface WelfareProfile {
  totalContributions: number | string;
  contributionCount: number;
  lastContributionDate: string | null;
  totalPayoutsReceived: number | string;
  payoutCount: number;
  pendingRequests: number;
}

const LOGIN_LABELS: Record<string, string> = {
  active: 'Can sign in',
  invited: 'Invited',
  no_login: 'No login',
};

export default function MemberDetailPage() {
  // A standalone thrift group's person has no finance, cooperative, welfare, attendance, category, occupation or date of birth: those are an association's.
  const { thriftOnly } = useAjoNav();
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendance, setAttendance] = useState<AttendanceTotals | null>(null);
  const [welfare, setWelfare] = useState<WelfareProfile | null>(null);
  const { can } = usePermissions();
  const canSeeAttendance = can(PERMISSIONS.MEETING_VIEW);
  const canSeeWelfare = can(PERMISSIONS.WELFARE_MANAGE);

  useEffect(() => {
    fetchMember();
  }, [memberId]);

  // Attendance and welfare summaries are optional extras: a module the plan doesn't include answers non-OK, and the card just stays hidden.
  useEffect(() => {
    const load = async () => {
      if (canSeeAttendance) {
        try {
          const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/attendance-history?memberId=${memberId}`);
          if (response.ok) {
            const data = await response.json();
            setAttendance(data.data?.[0] ?? null);
          }
        } catch (error) {
          console.error('Error fetching member attendance:', error);
        }
      }
      if (canSeeWelfare) {
        try {
          const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/welfare/members/${memberId}/profile`);
          if (response.ok) {
            const data = await response.json();
            setWelfare(data.data ?? null);
          }
        } catch (error) {
          console.error('Error fetching member welfare profile:', error);
        }
      }
    };
    load();
  }, [memberId, canSeeAttendance, canSeeWelfare]);

  const fetchMember = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }

      const data = await response.json();
      setMember(data.data);
    } catch (error: any) {
      console.error('Error fetching member:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    modals.openConfirmModal({
      title: 'Disable Member',
      children: (
        <Text size="sm">
          {member?.firstName} {member?.lastName} won&apos;t be able to sign in, and they&apos;re marked Disabled.
          You can enable them again any time.
        </Text>
      ),
      labels: { confirm: 'Disable member', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to disable member');
          }

          toast.success('Member disabled');
          fetchMember();
        } catch (error: any) {
          toast.error(error.message || 'Failed to disable member');
        }
      },
    });
  };

  const handleEnable = async () => {
    try {
      const response = await apiPatch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`,
        { status: 'active' }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to enable member');
      }

      toast.success('Member enabled');
      fetchMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to enable member');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      terminated: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
    };

    return (
      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${badges[status] || badges.active}`}>
        {status === 'terminated' ? 'disabled' : status}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading member details...</div>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400">{error || 'Member not found'}</div>
          <button
            onClick={() => router.push('/dashboard/members')}
            className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Back to Members
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/dashboard/members')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {can(PERMISSIONS.MEMBER_EDIT) ? (
              <ProfilePhotoEditor
                name={`${member.firstName} ${member.lastName}`}
                imageUrl={member.photoUrl}
                target={member.id}
                size={72}
                onChanged={(photoUrl, thumbUrl) => setMember((current) => (current ? { ...current, photoUrl, thumbUrl } : current))}
              />
            ) : (
              <MemberAvatar name={`${member.firstName} ${member.lastName}`} imageUrl={member.photoUrl} size={56} />
            )}
            
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                  {member.firstName} {member.lastName}
                </h1>
                {getStatusBadge(member.status)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                ID: {member.memberId} · {LOGIN_LABELS[member.loginStatus || 'no_login'] || member.loginStatus}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Full width on mobile */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {telHref(member.phone) && (
            <a
              href={telHref(member.phone)!}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>Call</span>
            </a>
          )}
          {whatsappHref(member.phone) && (
            <a
              href={whatsappHref(member.phone)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          )}
          {mailHref(member.email) && (
            <a
              href={mailHref(member.email)!}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </a>
          )}
          <Can permission={PERMISSIONS.LEDGER_VIEW_MEMBER_STATEMENT}>
            <button
              onClick={() => router.push(`/dashboard/finance/member-ledger/${memberId}`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Statement</span>
            </button>
          </Can>
          {!thriftOnly && (
          <button
            onClick={() => router.push(`/dashboard/cooperatives/members/${memberId}`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <PiggyBank className="w-4 h-4" />
            <span>Cooperative Profile</span>
          </button>
          )}
          <Can permission={PERMISSIONS.MEMBER_EDIT}>
            <button
              onClick={() => router.push(`/dashboard/members/${memberId}/edit`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </Can>

          {member.status === 'terminated' ? (
            <Can permission={PERMISSIONS.MEMBER_EDIT}>
              <button
                onClick={handleEnable}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span>Enable member</span>
              </button>
            </Can>
          ) : (
            <Can permission={PERMISSIONS.MEMBER_DELETE}>
              <button
                onClick={handleDisable}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disable</span>
              </button>
            </Can>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      {!thriftOnly && member.financialSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between sm:flex-col sm:items-start">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Total Dues</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white sm:mt-2">
                {formatCurrency(member.financialSummary.totalDues)}
              </p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between sm:flex-col sm:items-start">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Total Paid</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white sm:mt-2">
                {formatCurrency(member.financialSummary.totalPaid)}
              </p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between sm:flex-col sm:items-start">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Balance</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white sm:mt-2">
                {formatCurrency(member.financialSummary.balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Personal Information
          </h2>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Email */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</p>
                <p className="text-gray-900 dark:text-white mt-0.5 truncate">{member.email || '-'}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</p>
                <p className="text-gray-900 dark:text-white mt-0.5">{member.phone || '-'}</p>
              </div>
            </div>

            {/* Date of Birth */}
            {!thriftOnly && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date of Birth</p>
                <p className="text-gray-900 dark:text-white mt-0.5">{formatDate(member.dateOfBirth)}</p>
              </div>
            </div>

            )}
            {/* Gender */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gender</p>
                <p className="text-gray-900 dark:text-white mt-0.5 capitalize">{member.gender}</p>
              </div>
            </div>

            {/* Occupation */}
            {!thriftOnly && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Occupation</p>
                <p className="text-gray-900 dark:text-white mt-0.5">{member.occupation || '-'}</p>
              </div>
            </div>

            )}
            {/* Address - Full width on mobile */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:col-span-2 lg:col-span-1">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Address</p>
                <p className="text-gray-900 dark:text-white mt-0.5">
                  {[member.address, member.city, member.state, member.country]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Membership Information Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {thriftOnly ? 'In the group' : 'Membership Information'}
          </h2>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!thriftOnly && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</p>
                <p className="text-gray-900 dark:text-white mt-1 capitalize font-medium">{member.category}</p>
              </div>
            )}

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Join Date</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">{formatDate(member.joinDate)}</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Member For</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">
                {Math.floor(
                  (new Date().getTime() - new Date(member.joinDate).getTime()) /
                    (1000 * 60 * 60 * 24 * 365)
                )}{' '}
                years
              </p>
            </div>
          </div>
        </div>
      </div>

      <PersonCircles memberId={Number(memberId)} />

      {/* Attendance Summary Card */}
      {!thriftOnly && attendance && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Attendance</h2>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Attendance', value: `${attendance.attendanceRate}%` },
              { label: 'Meetings', value: attendance.totalMeetings },
              { label: 'Attended', value: attendance.attended },
              { label: 'Absent', value: attendance.absent },
              { label: 'Apologies', value: attendance.apologies },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{item.label}</p>
                <p className="text-gray-900 dark:text-white mt-1 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welfare Summary Card */}
      {!thriftOnly && welfare && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Heart className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Welfare</h2>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contributed</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">{formatCurrency(Number(welfare.totalContributions))}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{welfare.contributionCount} contributions</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Received</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">{formatCurrency(Number(welfare.totalPayoutsReceived))}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{welfare.payoutCount} payouts</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last contribution</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">{formatDate(welfare.lastContributionDate)}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Requests waiting</p>
              <p className="text-gray-900 dark:text-white mt-1 font-medium">{welfare.pendingRequests}</p>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Contact Card */}
      {(member.emergencyContactName || member.emergencyContactPhone) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Emergency Contact
            </h2>
          </div>
          
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</p>
                <p className="text-gray-900 dark:text-white mt-1 font-medium">
                  {member.emergencyContactName || '-'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</p>
                <p className="text-gray-900 dark:text-white mt-1 font-medium">
                  {member.emergencyContactPhone || '-'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Relationship</p>
                <p className="text-gray-900 dark:text-white mt-1 font-medium">
                  {member.emergencyContactRelationship || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Card */}
      {member.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Additional Notes
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm sm:text-base">
              {member.notes}
            </p>
          </div>
        </div>
      )}

      {/* System Information Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Information
          </h2>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created At</p>
              <p className="text-gray-900 dark:text-white mt-1">{formatDate(member.createdAt)}</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Updated</p>
              <p className="text-gray-900 dark:text-white mt-1">{formatDate(member.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
