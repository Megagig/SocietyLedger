'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type Tenant = {
  id: number;
  name: string;
  subdomain: string;
  tier: string;
  status: string;
  isDeleted: boolean;
  createdAt: string;
  userCount: number;
  memberCount: number;
  plan: { name: string; code: string } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function TenantsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<'suspend' | 'reactivate' | 'restore' | 'soft-delete' | 'force-logout' | null>(null);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchTenants();
  }, [token, user, pagination.page, search, statusFilter, tierFilter, showDeleted]);

  const fetchTenants = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (tierFilter) params.append('tier', tierFilter);
      if (showDeleted) params.append('includeDeleted', 'true');

      const res = await fetch(`${API_ROUTES.PLATFORM_ADMIN.TENANTS}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setTenants(data.data.tenants || []);
        setPagination(prev => ({ ...prev, ...data.data.pagination }));
      }
    } catch (e) {
      console.error('Failed to fetch tenants:', e);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (tenantId: number, action: string, body?: object) => {
    setActionLoading(tenantId);
    try {
      let url = '';
      switch (action) {
        case 'suspend':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_SUSPEND(tenantId);
          break;
        case 'reactivate':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_REACTIVATE(tenantId);
          break;
        case 'soft-delete':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_SOFT_DELETE(tenantId);
          break;
        case 'restore':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_RESTORE(tenantId);
          break;
        case 'force-logout':
          url = API_ROUTES.PLATFORM_ADMIN.TENANT_FORCE_LOGOUT(tenantId);
          break;
        default:
          return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Action completed successfully`);
        fetchTenants();
      } else {
        toast.error(data.message || 'Action failed');
      }
    } catch (e) {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const openActionModal = (tenantId: number, action: 'suspend' | 'reactivate' | 'restore' | 'soft-delete' | 'force-logout') => {
    setSelectedTenantId(tenantId);
    setSelectedAction(action);
    setShowActionModal(true);
  };

  const handleActionSubmit = (reason: string) => {
    if (!selectedTenantId || !selectedAction) return;
    handleAction(selectedTenantId, selectedAction, { reason });
    setShowActionModal(false);
    setSelectedTenantId(null);
    setSelectedAction(null);
  };

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Tenant Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Tenant Management</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Manage tenant lifecycle, modules, billing, and security
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <input
          type="text"
          placeholder="Search by name or subdomain..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Tiers</option>
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-2">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Deleted
        </label>
      </div>

      {/* Tenants List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No tenants found</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {tenants.map((tenant) => (
                <div key={tenant.id} className={`p-4 space-y-3 ${tenant.isDeleted ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{tenant.name}</h3>
                      <p className="text-xs text-gray-500">{tenant.subdomain}.societyledger.com</p>
                      {tenant.isDeleted && (
                        <span className="text-xs text-red-500">Deleted</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      tenant.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {tenant.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded font-medium ${
                      tenant.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      tenant.tier === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {tenant.tier}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {tenant.userCount} users • {tenant.memberCount} members
                    </span>
                    {tenant.plan && (
                      <span className="text-gray-500 dark:text-gray-400">
                        • {tenant.plan.name}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                    >
                      View
                    </Link>
                    {tenant.isDeleted ? (
                      <button
                        onClick={() => openActionModal(tenant.id, 'restore')}
                        disabled={actionLoading === tenant.id}
                        className="px-3 py-1.5 text-xs text-green-600 hover:text-green-700 border border-green-200 rounded hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 disabled:opacity-50"
                      >
                        {actionLoading === tenant.id ? '...' : 'Restore'}
                      </button>
                    ) : (
                      <>
                        {tenant.status === 'ACTIVE' ? (
                          <button
                            onClick={() => openActionModal(tenant.id, 'suspend')}
                            disabled={actionLoading === tenant.id}
                            className="px-3 py-1.5 text-xs text-yellow-600 hover:text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/30 disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => openActionModal(tenant.id, 'reactivate')}
                            disabled={actionLoading === tenant.id}
                            className="px-3 py-1.5 text-xs text-green-600 hover:text-green-700 border border-green-200 rounded hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => openActionModal(tenant.id, 'force-logout')}
                          disabled={actionLoading === tenant.id}
                          className="px-3 py-1.5 text-xs text-orange-600 hover:text-orange-700 border border-orange-200 rounded hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/30 disabled:opacity-50"
                        >
                          Logout All
                        </button>
                        <button
                          onClick={() => openActionModal(tenant.id, 'soft-delete')}
                          disabled={actionLoading === tenant.id}
                          className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Tenant</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Tier</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Users</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Members</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Subscription</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${tenant.isDeleted ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-white">{tenant.name}</div>
                        <div className="text-xs text-gray-500">{tenant.subdomain}.societyledger.com</div>
                        {tenant.isDeleted && (
                          <span className="text-xs text-red-500">Deleted</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tenant.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                          tenant.tier === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {tenant.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          tenant.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">{tenant.userCount}</td>
                      <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-300">{tenant.memberCount}</td>
                      <td className="py-3 px-4">
                        {tenant.plan ? (
                          <div className="text-gray-900 dark:text-white text-xs">{tenant.plan.name}</div>
                        ) : (
                          <span className="text-gray-400 text-xs">No subscription</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-1 flex-wrap">
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                          >
                            View
                          </Link>
                          {tenant.isDeleted ? (
                            <button
                              onClick={() => openActionModal(tenant.id, 'restore')}
                              disabled={actionLoading === tenant.id}
                              className="px-3 py-1.5 text-xs text-green-600 hover:text-green-700 border border-green-200 rounded hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 disabled:opacity-50"
                            >
                              {actionLoading === tenant.id ? '...' : 'Restore'}
                            </button>
                          ) : (
                            <>
                              {tenant.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => openActionModal(tenant.id, 'suspend')}
                                  disabled={actionLoading === tenant.id}
                                  className="px-3 py-1.5 text-xs text-yellow-600 hover:text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/30 disabled:opacity-50"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                    onClick={() => openActionModal(tenant.id, 'reactivate')}
                                  disabled={actionLoading === tenant.id}
                                  className="px-3 py-1.5 text-xs text-green-600 hover:text-green-700 border border-green-200 rounded hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30 disabled:opacity-50"
                                >
                                  Reactivate
                                </button>
                              )}
                              <button
                                onClick={() => openActionModal(tenant.id, 'force-logout')}
                                disabled={actionLoading === tenant.id}
                                className="px-3 py-1.5 text-xs text-orange-600 hover:text-orange-700 border border-orange-200 rounded hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/30 disabled:opacity-50"
                              >
                                Logout All
                              </button>
                              <button
                                onClick={() => openActionModal(tenant.id, 'soft-delete')}
                                disabled={actionLoading === tenant.id}
                                className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedAction && (
        <TenantActionModal
          action={selectedAction}
          onClose={() => {
            setShowActionModal(false);
            setSelectedTenantId(null);
            setSelectedAction(null);
          }}
          onSubmit={handleActionSubmit}
        />
      )}
    </div>
  );
}

// Tenant Action Modal Component
function TenantActionModal({ action, onClose, onSubmit }: {
  action: 'suspend' | 'reactivate' | 'restore' | 'soft-delete' | 'force-logout';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  const titles: Record<string, string> = {
    'suspend': 'Suspend Tenant',
    'reactivate': 'Reactivate Tenant',
    'restore': 'Restore Tenant',
    'soft-delete': 'Delete Tenant',
    'force-logout': 'Force Logout All Users',
  };

  const descriptions: Record<string, string> = {
    'suspend': 'Suspend this tenant and block access for all users.',
    'reactivate': 'Reactivate this suspended tenant.',
    'restore': 'Restore this deleted tenant.',
    'soft-delete': 'Soft delete this tenant. This can be reversed later.',
    'force-logout': 'Force logout all users from this tenant.',
  };

  const colors: Record<string, string> = {
    'suspend': 'yellow',
    'reactivate': 'green',
    'restore': 'green',
    'soft-delete': 'red',
    'force-logout': 'orange',
  };

  const color = colors[action];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{titles[action]}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{descriptions[action]}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason *
            </label>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={`Enter reason for ${action.replace('-', ' ')}...`}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (reason.trim()) {
                onSubmit(reason.trim());
              }
            }}
            disabled={!reason.trim()}
            className={`px-4 py-2 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
