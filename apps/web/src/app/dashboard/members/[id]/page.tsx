'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Calendar, User, DollarSign } from 'lucide-react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiDelete } from '@/utils/api';
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
  createdAt: string;
  updatedAt: string;
  financialSummary?: {
    totalDues: number;
    totalPaid: number;
    balance: number;
  };
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMember();
  }, [memberId]);

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

  const handleDelete = async () => {
    modals.openConfirmModal({
      title: 'Delete Member',
      children: (
        <Text size="sm">
          Are you sure you want to delete this member? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to delete member');
          }

          toast.success('Member deleted successfully');
          router.push('/dashboard/members');
        } catch (error: any) {
          toast.error(error.message || 'Failed to delete member');
        }
      },
    });
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
        {status}
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
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">
              {member.firstName.charAt(0)}{member.lastName.charAt(0)}
            </div>
            
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                  {member.firstName} {member.lastName}
                </h1>
                {getStatusBadge(member.status)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                ID: {member.memberId}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Full width on mobile */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Can permission={PERMISSIONS.MEMBER_EDIT}>
            <button
              onClick={() => router.push(`/dashboard/members/${memberId}/edit`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </Can>
          
          <Can permission={PERMISSIONS.MEMBER_DELETE}>
            <button
              onClick={handleDelete}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </Can>
        </div>
      </div>

      {/* Financial Summary Cards */}
      {member.financialSummary && (
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
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date of Birth</p>
                <p className="text-gray-900 dark:text-white mt-0.5">{formatDate(member.dateOfBirth)}</p>
              </div>
            </div>

            {/* Gender */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gender</p>
                <p className="text-gray-900 dark:text-white mt-0.5 capitalize">{member.gender}</p>
              </div>
            </div>

            {/* Occupation */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Occupation</p>
                <p className="text-gray-900 dark:text-white mt-0.5">{member.occupation || '-'}</p>
              </div>
            </div>

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
            Membership Information
          </h2>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</p>
              <p className="text-gray-900 dark:text-white mt-1 capitalize font-medium">{member.category}</p>
            </div>

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
