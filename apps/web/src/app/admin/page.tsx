'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import Link from 'next/link';

type Stats = {
  overview: {
    totalAssociations: number;
    activeAssociations: number;
    suspendedAssociations: number;
    totalUsers: number;
    totalMembers: number;
    pendingApprovals: number;
  };
  growth: {
    newAssociationsThisMonth: number;
    newAssociationsThisWeek: number;
  };
  subscriptions: Record<string, number>;
  tiers: Record<string, number>;
  revenue: {
    total: number;
    thisMonth: number;
  };
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
    association: { id: number; name: string; subdomain: string } | null;
  };
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentApprovals, setRecentApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const [statsRes, approvalsRes] = await Promise.all([
        fetch(API_ROUTES.ADMIN.STATS, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(`${API_ROUTES.ADMIN.APPROVALS}?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const statsData = await statsRes.json();
      const approvalsData = await approvalsRes.json();

      if (statsData.success) setStats(statsData.data);
      if (approvalsData.success) setRecentApprovals(approvalsData.data.approvals || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Super admin access required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Platform Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Welcome back, Super Admin
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/associations"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Manage Associations
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="Total Associations"
              value={stats.overview.totalAssociations}
              icon="🏢"
            />
            <StatCard
              label="Active"
              value={stats.overview.activeAssociations}
              icon="✅"
              color="green"
            />
            <StatCard
              label="Suspended"
              value={stats.overview.suspendedAssociations}
              icon="⏸️"
              color="yellow"
            />
            <StatCard
              label="Total Users"
              value={stats.overview.totalUsers}
              icon="👥"
            />
            <StatCard
              label="Total Members"
              value={stats.overview.totalMembers}
              icon="👤"
            />
            <StatCard
              label="Pending Approvals"
              value={stats.overview.pendingApprovals}
              icon="⏳"
              color={stats.overview.pendingApprovals > 0 ? 'red' : undefined}
              href="/admin/associations"
            />
          </div>

          {/* Growth & Revenue */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
              <p className="text-blue-100 text-sm">New This Week</p>
              <p className="text-3xl font-bold mt-1">{stats.growth.newAssociationsThisWeek}</p>
              <p className="text-blue-200 text-xs mt-2">associations</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
              <p className="text-purple-100 text-sm">New This Month</p>
              <p className="text-3xl font-bold mt-1">{stats.growth.newAssociationsThisMonth}</p>
              <p className="text-purple-200 text-xs mt-2">associations</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
              <p className="text-green-100 text-sm">Revenue This Month</p>
              <p className="text-3xl font-bold mt-1">₦{Number(stats.revenue.thisMonth).toLocaleString()}</p>
              <p className="text-green-200 text-xs mt-2">NGN</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white">
              <p className="text-teal-100 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold mt-1">₦{Number(stats.revenue.total).toLocaleString()}</p>
              <p className="text-teal-200 text-xs mt-2">all time</p>
            </div>
          </div>

          {/* Tier & Subscription Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tier Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Tier Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.tiers).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        tier === 'ENTERPRISE' ? 'bg-purple-500' :
                        tier === 'PROFESSIONAL' ? 'bg-blue-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {tier.toLowerCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Subscription Status
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.subscriptions).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        status === 'ACTIVE' ? 'bg-green-500' :
                        status === 'TRIALING' ? 'bg-blue-500' :
                        status === 'PAST_DUE' ? 'bg-yellow-500' :
                        status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {status.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Pending Approvals */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Recent Pending Approvals
          </h3>
          <Link
            href="/admin/associations"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            View all →
          </Link>
        </div>
        {recentApprovals.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No pending approvals
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Association</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Role</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Verified</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentApprovals.map((approval) => (
                  <tr key={approval.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-3 px-2 text-gray-900 dark:text-white">{approval.user.email}</td>
                    <td className="py-3 px-2 text-gray-600 dark:text-gray-300">
                      {approval.user.association?.name || '-'}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        approval.user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {approval.user.role}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {approval.user.emailVerified ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-500 dark:text-gray-400">
                      {new Date(approval.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickLink href="/admin/associations" icon="🏢" label="Associations" />
        <QuickLink href="/admin/analytics" icon="📊" label="Analytics" />
        <QuickLink href="/admin/audit-logs" icon="📋" label="Audit Logs" />
        <QuickLink href="/admin/settings" icon="⚙️" label="Settings" />
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color,
  href 
}: { 
  label: string; 
  value: number; 
  icon: string;
  color?: 'green' | 'yellow' | 'red';
  href?: string;
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  };

  const content = (
    <div className={`rounded-xl p-4 border ${color ? colorClasses[color] : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} ${href ? 'hover:shadow-md transition cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${
        color === 'red' ? 'text-red-600' :
        color === 'green' ? 'text-green-600' :
        color === 'yellow' ? 'text-yellow-600' :
        'text-gray-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
    </Link>
  );
}
