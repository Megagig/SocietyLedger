'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, UserPlus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiPost } from '@/utils/api';

interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  loginStatus: string;
}

interface InviteResult {
  memberId: number;
  success: boolean;
  message: string;
}

export default function InviteMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<InviteResult[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEligibleMembers();
  }, []);

  const fetchEligibleMembers = async () => {
    setIsLoading(true);
    try {
      // Fetch members who have email and are not yet invited/active
      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?limit=500`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      // Filter members with email who haven't been invited yet
      const eligible = data.data.members.filter(
        (m: Member) => m.email && m.loginStatus !== 'active'
      );
      setMembers(eligible);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map((m) => m.id));
    }
  };

  const handleToggleMember = (id: number) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleSendInvites = async () => {
    if (selectedMembers.length === 0) {
      setError('Please select at least one member to invite');
      return;
    }

    setIsSending(true);
    setError('');
    setResults([]);

    try {
      const response = await apiPost(
        `${process.env.NEXT_PUBLIC_API_URL}/api/member-invites/bulk-invite`,
        { memberIds: selectedMembers }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send invitations');
      }

      setResults(data.data.results);
      setSelectedMembers([]);
      // Refresh the list to update login statuses
      fetchEligibleMembers();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const searchLower = search.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(searchLower) ||
      m.lastName.toLowerCase().includes(searchLower) ||
      m.email?.toLowerCase().includes(searchLower) ||
      m.memberId.toLowerCase().includes(searchLower)
    );
  });

  const getLoginStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      no_login: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      invited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };

    const labels: Record<string, string> = {
      no_login: 'Not Invited',
      invited: 'Invited',
      active: 'Active',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.no_login}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
              Invite Members
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Send login invitations to members with email addresses
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            Invitation Results
          </h3>
          {results.map((result, idx) => {
            const member = members.find((m) => m.id === result.memberId);
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 p-2 rounded ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>
                  {member ? `${member.firstName} ${member.lastName}` : `Member #${result.memberId}`}: {result.message}
                </span>
              </div>
            );
          })}
          <button
            onClick={() => setResults([])}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-800 dark:text-red-200">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedMembers.length} selected
            </span>
            <button
              onClick={handleSendInvites}
              disabled={selectedMembers.length === 0 || isSending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send Invites'}
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading members...</div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <UserPlus className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400">
            {members.length === 0
              ? 'No members with email addresses available for invitation'
              : 'No members match your search'}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Member ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Login Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                    selectedMembers.includes(member.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => handleToggleMember(member.id)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => handleToggleMember(member.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {member.memberId}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {member.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getLoginStatusBadge(member.loginStatus)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
