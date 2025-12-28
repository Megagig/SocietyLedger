'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Association = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: string;
  status: string;
  createdAt: string;
  _count: { users: number; members: number; transactions: number };
  subscriptions: { plan: { name: string }; status: string }[];
};

type PendingApproval = {
  id: number;
  userId: number;
  approvalStatus: string;
  createdAt: string;
  user: {
    id: number;
    email: string;
    role: string;
    emailVerified: boolean;
    createdAt: string;
    association: { id: number; name: string; subdomain: string } | null;
  };
};

export default function AssociationsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'associations' | 'approvals'>('associations');
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, page, search, statusFilter, tierFilter]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (tierFilter) params.append('tier', tierFilter);

      const [assocRes, approvalsRes] = await Promise.all([
        fetch(`${API_ROUTES.ADMIN.ASSOCIATIONS}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.ADMIN.APPROVALS, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const assocData = await assocRes.json();
      const approvalsData = await approvalsRes.json();

      if (assocData.success) {
        setAssociations(assocData.data.associations || []);
        setTotalPages(assocData.data.totalPages || 1);
      }
      if (approvalsData.success) {
        setPendingApprovals(approvalsData.data.approvals || []);
      }
    } catch (e) {
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (associationId: number) => {
    if (!confirm('Are you sure you want to suspend this association?')) return;
    
    const reason = prompt('Enter suspension reason (optional):');
    setActionLoading(associationId);

    try {
      const res = await fetch(API_ROUTES.ADMIN.SUSPEND_ASSOCIATION(associationId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        toast.success('Association suspended successfully');
      } else {
        toast.error(data.message || 'Failed to suspend');
      }
    } catch (e) {
      toast.error('Failed to suspend association');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (associationId: number) => {
    if (!confirm('Are you sure you want to reactivate this association?')) return;
    setActionLoading(associationId);

    try {
      const res = await fetch(API_ROUTES.ADMIN.REACTIVATE_ASSOCIATION(associationId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        toast.success('Association reactivated successfully');
      } else {
        toast.error(data.message || 'Failed to reactivate');
      }
    } catch (e) {
      toast.error('Failed to reactivate association');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproval = async (userId: number, status: 'approved' | 'rejected', rejectionReason?: string) => {
    setActionLoading(userId);

    try {
      const res = await fetch(API_ROUTES.ADMIN.APPROVAL_BY_ID(userId), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status, rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        toast.success(`User ${status} successfully`);
      } else {
        toast.error(data.message || 'Action failed');
      }
    } catch (e) {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: number) => {
    const reason = prompt('Enter rejection reason (optional):');
    await handleApproval(userId, 'rejected', reason || undefined);
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Associations</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Association Management
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('associations')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'associations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Associations ({associations.length})
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'approvals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approvals
            {pendingApprovals.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Associations Tab */}
      {activeTab === 'associations' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search by name or subdomain..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Tiers</option>
              <option value="STARTER">Starter</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>

          {/* Associations Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : associations.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No associations found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Association</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Subdomain</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Tier</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Users</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Members</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Created</th>
                      <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associations.map((assoc) => (
                      <tr key={assoc.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">{assoc.name}</div>
                          <div className="text-xs text-gray-500">ID: {assoc.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={`http://${assoc.subdomain}.localhost:3000`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {assoc.subdomain}
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            assoc.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            assoc.tier === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {assoc.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            assoc.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            assoc.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {assoc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">{assoc._count.users}</td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">{assoc._count.members}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(assoc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Link
                              href={`/admin/associations/${assoc.id}`}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                            >
                              View
                            </Link>
                            {assoc.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleSuspend(assoc.id)}
                                disabled={actionLoading === assoc.id}
                                className="px-2 py-1 text-xs text-yellow-600 hover:text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/30 disabled:opacity-50"
                              >
                                {actionLoading === assoc.id ? '...' : 'Suspend'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(assoc.id)}
                                disabled={actionLoading === assoc.id}
                                className="px-2 py-1 text-xs text-green-600 hover:text-green-700 border border-green-200 rounded hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 disabled:opacity-50"
                              >
                                {actionLoading === assoc.id ? '...' : 'Reactivate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">✓ All caught up!</p>
              <p className="text-sm mt-2">No pending approvals</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Association</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Role</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Email Verified</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Registered</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((approval) => (
                    <tr key={approval.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{approval.user.email}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {approval.user.association ? (
                          <span>
                            {approval.user.association.name}
                            <span className="text-gray-400 text-xs ml-1">
                              ({approval.user.association.subdomain})
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          approval.user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {approval.user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {approval.user.emailVerified ? (
                          <span className="text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-red-600">✗ No</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(approval.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleApproval(approval.user.id, 'approved')}
                            disabled={actionLoading === approval.user.id}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === approval.user.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(approval.user.id)}
                            disabled={actionLoading === approval.user.id}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
