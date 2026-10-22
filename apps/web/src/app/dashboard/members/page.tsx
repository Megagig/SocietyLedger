'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Member } from '@/types';
import { PERMISSIONS } from '@/lib/permissions';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { apiGet, apiDelete } from '@/utils/api';
import { toast } from '@/lib/toast';
import { Search, Plus, Edit, Trash2, Eye, UserPlus } from 'lucide-react';
import { HelpLink } from '@/components/docs/HelpLink';

interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  newThisMonth: number;
  withLogin: number;
}

const LOGIN_LABELS: Record<string, string> = {
  active: 'Can sign in',
  invited: 'Invited',
  no_login: 'No login',
};

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters and pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loginFilter, setLoginFilter] = useState('');
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [waitingApprovals, setWaitingApprovals] = useState(0);
  const { can } = usePermissions();
  const canApprove = can(PERMISSIONS.MEMBER_EDIT_ALL);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchMembers();
  }, [search, statusFilter, categoryFilter, loginFilter, page, limit]);

  // How many self-registrations are waiting — only officers who can approve them ask.
  useEffect(() => {
    if (!canApprove) return;
    const fetchWaiting = async () => {
      try {
        const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/approvals?status=pending&limit=1`);
        if (!response.ok) return;
        const data = await response.json();
        setWaitingApprovals(data.data?.total ?? 0);
      } catch (error) {
        console.error('Error fetching pending approvals:', error);
      }
    };
    fetchWaiting();
  }, [canApprove]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}/api/members/stats`);
        if (!response.ok) return;
        const data = await response.json();
        setStats(data.data);
      } catch (error) {
        console.error('Error fetching member stats:', error);
      }
    };
    fetchStats();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(loginFilter && { loginStatus: loginFilter }),
      });

      const response = await apiGet(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.data.members);
      setTotalPages(data.data.pagination.totalPages);
      setTotalCount(data.data.pagination.totalCount);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async (id: number) => {
    modals.openConfirmModal({
      title: 'Disable Member',
      children: (
        <Text size="sm">
          This member won&apos;t be able to sign in, and they&apos;re marked Disabled. You can enable them again any time.
        </Text>
      ),
      labels: { confirm: 'Disable member', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await apiDelete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/members/${id}`
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to disable member');
          }

          toast.success('Member disabled');
          fetchMembers();
        } catch (error: any) {
          toast.error(error.message || 'Failed to disable member');
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.active}`}>
        {status === 'terminated' ? 'disabled' : status}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Members
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage your association members ({totalCount} total)
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <HelpLink />
          <Can permission={PERMISSIONS.MEMBER_EDIT_ALL}>
            <button
              onClick={() => router.push('/dashboard/settings/pending-approvals')}
              className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
            >
              <span>Approvals</span>
              {waitingApprovals > 0 && (
                <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                  {waitingApprovals} waiting
                </span>
              )}
            </button>
          </Can>
          <Can permission={PERMISSIONS.MEMBER_CREATE}>
            <button
              onClick={() => router.push('/dashboard/members/invite')}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite Members</span>
              <span className="sm:hidden">Invite</span>
            </button>
          </Can>
          
          <Can permission={PERMISSIONS.MEMBER_CREATE}>
            <button
              onClick={() => router.push('/dashboard/members/create')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sm:hidden">Add</span>
            </button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total members', value: stats.totalMembers },
            { label: 'Active', value: stats.activeMembers },
            { label: 'New this month', value: stats.newThisMonth },
            { label: 'Can sign in', value: stats.withLogin },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or member ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Disabled</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="regular">Regular</option>
              <option value="executive">Executive</option>
              <option value="honorary">Honorary</option>
              <option value="student">Student</option>
            </select>
          </div>

          {/* Login Filter */}
          <div>
            <select
              value={loginFilter}
              onChange={(e) => {
                setLoginFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Logins</option>
              <option value="active">Can sign in</option>
              <option value="invited">Invited</option>
              <option value="no_login">No login</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading members...</div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-gray-600 dark:text-gray-400">No members found</div>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {member.firstName} {member.lastName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        ID: {member.memberId}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(member.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.category}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{LOGIN_LABELS[member.loginStatus || 'no_login'] || member.loginStatus}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {member.email && <p className="truncate">{member.email}</p>}
                    {member.phone && <p>{member.phone}</p>}
                  </div>
                  
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => router.push(`/dashboard/members/${member.id}`)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 text-sm"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    
                    <Can permission={PERMISSIONS.MEMBER_EDIT}>
                      <button
                        onClick={() => router.push(`/dashboard/members/${member.id}/edit`)}
                        className="flex items-center gap-1 text-green-600 hover:text-green-900 dark:text-green-400 text-sm"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                    </Can>
                    
                    <Can permission={PERMISSIONS.MEMBER_DELETE}>
                      <button
                        onClick={() => handleDisable(member.id)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-900 dark:text-red-400 text-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Disable
                      </button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Member ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {member.memberId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {member.firstName} {member.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {member.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {member.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(member.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {member.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {LOGIN_LABELS[member.loginStatus || 'no_login'] || member.loginStatus}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => router.push(`/dashboard/members/${member.id}`)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        
                        <Can permission={PERMISSIONS.MEMBER_EDIT}>
                          <button
                            onClick={() => router.push(`/dashboard/members/${member.id}/edit`)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 inline" />
                          </button>
                        </Can>
                        
                        <Can permission={PERMISSIONS.MEMBER_DELETE}>
                          <button
                            onClick={() => handleDisable(member.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Disable"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 rounded-lg shadow px-4 sm:px-6 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} members
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {page} / {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
