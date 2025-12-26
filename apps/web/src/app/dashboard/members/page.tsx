'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Member } from '@/types';
import { PERMISSIONS } from '@/lib/permissions';
import { Can } from '@/hooks/usePermissions';
import { apiGet, apiDelete } from '@/utils/api';
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters and pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchMembers();
  }, [search, statusFilter, categoryFilter, page, limit]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { category: categoryFilter }),
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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
      const response = await apiDelete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members/${id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete member');
      }

      alert('Member deleted successfully');
      fetchMembers();
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.active}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Members
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your association members ({totalCount} total)
          </p>
        </div>
        
        <Can permission={PERMISSIONS.MEMBER_CREATE}>
          <button
            onClick={() => router.push('/dashboard/members/create')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </Can>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="overflow-x-auto">
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
                            onClick={() => handleDelete(member.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
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
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow px-6 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} members
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>

              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
