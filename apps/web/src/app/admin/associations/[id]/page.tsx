'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import { getSubdomainUrl } from '@/utils/domain';
import Link from 'next/link';

type AssociationDetail = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: string;
  status: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: string;
  subscriptionExpiresAt: string | null;
  _count: {
    users: number;
    members: number;
    transactions: number;
    payments: number;
    accounting: number;
  };
  subscriptions: {
    id: number;
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    plan: { name: string; priceMonthly: number };
    payments: { amount: number; status: string; paidAt: string }[];
  }[];
};

type Stats = {
  activeMembers: number;
  totalRevenue: number;
  pendingTransactions: number;
};

type AuditLog = {
  id: number;
  action: string;
  tableName: string;
  createdAt: string;
  user: { email: string } | null;
};

export default function AssociationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { token, user, setToken, setImpersonation } = useAuthStore();
  const [association, setAssociation] = useState<AssociationDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const associationId = Number(params.id);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, associationId]);

  const fetchData = async () => {
    if (!token || !associationId) return;
    setLoading(true);

    try {
      const res = await fetch(API_ROUTES.ADMIN.ASSOCIATION_BY_ID(associationId), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const result = await res.json();
      if (result.success) {
        setAssociation(result.data.association);
        setStats(result.data.stats);
        setRecentActivity(result.data.recentActivity || []);
      }
    } catch (e) {
      console.error('Failed to fetch association:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this association?')) return;
    const reason = prompt('Enter suspension reason (optional):');
    setActionLoading(true);

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
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirm('Are you sure you want to reactivate this association?')) return;
    setActionLoading(true);

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
      setActionLoading(false);
    }
  };

  const handleImpersonate = async () => {
    setActionLoading(true);

    try {
      const res = await fetch(API_ROUTES.ADMIN.IMPERSONATE(associationId.toString()), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        // Phase 22: Update auth store with impersonation state
        setToken(data.data.token);
        setImpersonation({
          id: data.data.association.id,
          name: data.data.association.name,
          subdomain: data.data.association.subdomain,
        });
        
        toast.success(`Now impersonating ${data.data.association.name}`);
        
        // Redirect to dashboard in same tab (context indicator will show)
        router.push('/dashboard');
      } else {
        toast.error(data.message || 'Failed to impersonate');
      }
    } catch (e) {
      toast.error('Failed to impersonate');
    } finally {
      setActionLoading(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!association) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Association not found
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/associations" className="hover:text-blue-600">Associations</Link>
            <span>/</span>
            <span>{association.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {association.name}
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              association.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              association.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {association.status}
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            <a
              href={getSubdomainUrl(association.subdomain)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {association.subdomain}.societyledger.com.ng
            </a>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImpersonate}
            disabled={actionLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            👤 Impersonate
          </button>
          {association.status === 'ACTIVE' ? (
            <button
              onClick={handleSuspend}
              disabled={actionLoading}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              ⏸️ Suspend
            </button>
          ) : (
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              ▶️ Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Users" value={association._count.users} icon="👥" />
        <StatCard label="Members" value={association._count.members} icon="👤" />
        <StatCard label="Active Members" value={stats?.activeMembers || 0} icon="✅" />
        <StatCard label="Transactions" value={association._count.transactions} icon="💳" />
        <StatCard label="Pending" value={stats?.pendingTransactions || 0} icon="⏳" />
        <StatCard label="Revenue" value={`₦${Number(stats?.totalRevenue || 0).toLocaleString()}`} icon="💰" />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Association Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Association Details</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">ID</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{association.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Slug</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{association.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Tier</dt>
              <dd>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  association.tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                  association.tier === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {association.tier}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="text-gray-900 dark:text-white">{new Date(association.createdAt).toLocaleDateString()}</dd>
            </div>
            {association.primaryColor && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Brand Color</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: association.primaryColor }}
                  />
                  <span className="text-gray-900 dark:text-white">{association.primaryColor}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Subscription Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subscription</h3>
          {association.subscriptions.length > 0 ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Plan</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {association.subscriptions[0].plan.name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                <dd>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    association.subscriptions[0].status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    association.subscriptions[0].status === 'TRIALING' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {association.subscriptions[0].status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Billing</dt>
                <dd className="text-gray-900 dark:text-white capitalize">
                  {association.subscriptions[0].billingCycle.toLowerCase()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Period Ends</dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(association.subscriptions[0].currentPeriodEnd).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No active subscription</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div>
                  <span className="text-gray-900 dark:text-white font-medium">{log.action}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                    on {log.tableName}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 dark:text-gray-400 text-sm">
                    {log.user?.email || 'System'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
