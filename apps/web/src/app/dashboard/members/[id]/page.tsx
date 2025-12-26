'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Calendar, User, DollarSign } from 'lucide-react';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';

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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`,
        {
          credentials: 'include',
        }
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
    if (!confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members/${memberId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete member');
      }

      alert('Member deleted successfully');
      router.push('/dashboard/members');
    } catch (error: any) {
      alert(error.message);
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[status] || badges.active}`}>
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
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading member details...</div>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-6">
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/members')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {member.firstName} {member.lastName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Member ID: {member.memberId}
            </p>
          </div>
          
          <div className="ml-4">
            {getStatusBadge(member.status)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Can permission={PERMISSIONS.MEMBER_EDIT}>
            <button
              onClick={() => router.push(`/dashboard/members/${memberId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </Can>
          
          <Can permission={PERMISSIONS.MEMBER_DELETE}>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </Can>
        </div>
      </div>

      {/* Financial Summary */}
      {member.financialSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">Total Dues</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(member.financialSummary.totalDues)}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(member.financialSummary.totalPaid)}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">Outstanding Balance</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(member.financialSummary.balance)}
            </p>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Personal Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-white">{member.email || '-'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
              <p className="text-gray-900 dark:text-white">{member.phone || '-'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Date of Birth</p>
              <p className="text-gray-900 dark:text-white">{formatDate(member.dateOfBirth)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gender</p>
              <p className="text-gray-900 dark:text-white capitalize">{member.gender}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Occupation</p>
              <p className="text-gray-900 dark:text-white">{member.occupation || '-'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
              <p className="text-gray-900 dark:text-white">
                {[member.address, member.city, member.state, member.country]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Membership Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Membership Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Category</p>
            <p className="text-gray-900 dark:text-white capitalize">{member.category}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Join Date</p>
            <p className="text-gray-900 dark:text-white">{formatDate(member.joinDate)}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
            <p className="text-gray-900 dark:text-white">
              {Math.floor(
                (new Date().getTime() - new Date(member.joinDate).getTime()) /
                  (1000 * 60 * 60 * 24 * 365)
              )}{' '}
              years
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      {(member.emergencyContactName || member.emergencyContactPhone) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Emergency Contact
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-white">
                {member.emergencyContactName || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
              <p className="text-gray-900 dark:text-white">
                {member.emergencyContactPhone || '-'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Relationship</p>
              <p className="text-gray-900 dark:text-white">
                {member.emergencyContactRelationship || '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {member.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Additional Notes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {member.notes}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Created At</p>
            <p className="text-gray-900 dark:text-white">{formatDate(member.createdAt)}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
            <p className="text-gray-900 dark:text-white">{formatDate(member.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
