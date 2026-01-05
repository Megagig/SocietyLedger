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
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
            Platform Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Welcome back, Super Admin
          </p>
        </div>
        <Link
          href="/admin/associations"
          className="block w-full sm:w-auto sm:inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm text-center"
        >
          Manage Associations
        </Link>
      </div>

      {/* Overview Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <StatCard label="Associations" value={stats.overview.totalAssociations} icon="🏢" />
            <StatCard label="Active" value={stats.overview.activeAssociations} icon="✅" color="green" />
            <StatCard label="Suspended" value={stats.overview.suspendedAssociations} icon="⏸️" color="yellow" />
            <StatCard label="Users" value={stats.overview.totalUsers} icon="👥" />
            <StatCard label="Members" value={stats.overview.totalMembers} icon="👤" />
            <StatCard label="Pending" value={stats.overview.pendingApprovals} icon="⏳" color={stats.overview.pendingApprovals > 0 ? 'red' : undefined} href="/admin/associations" />
          </div>

          {/* Growth & Revenue */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 sm:p-4 text-white">
              <p className="text-blue-100 text-[10px] sm:text-xs">New This Week</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">{stats.growth.newAssociationsThisWeek}</p>
              <p className="text-blue-200 text-[10px] sm:text-xs">associations</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 sm:p-4 text-white">
              <p className="text-purple-100 text-[10px] sm:text-xs">New This Month</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">{stats.growth.newAssociationsThisMonth}</p>
              <p className="text-purple-200 text-[10px] sm:text-xs">associations</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 sm:p-4 text-white">
              <p className="text-green-100 text-[10px] sm:text-xs">Revenue (Month)</p>
              <p className="text-lg sm:text-xl font-bold mt-1">₦{Number(stats.revenue.thisMonth).toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-3 sm:p-4 text-white">
              <p className="text-teal-100 text-[10px] sm:text-xs">Total Revenue</p>
              <p className="text-lg sm:text-xl font-bold mt-1">₦{Number(stats.revenue.total).toLocaleString()}</p>
            </div>
          </div>

          {/* Tier & Subscription Distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Tier Distribution</h3>
              <div className="space-y-2">
                {Object.entries(stats.tiers).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tier === 'ENTERPRISE' ? 'bg-purple-500' : tier === 'PROFESSIONAL' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{tier.toLowerCase()}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Subscription Status</h3>
              <div className="space-y-2">
                {Object.entries(stats.subscriptions).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : status === 'TRIALING' ? 'bg-blue-500' : status === 'PAST_DUE' ? 'bg-yellow-500' : status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{status.toLowerCase().replace('_', ' ')}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Pending Approvals */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Pending Approvals</h3>
          <Link href="/admin/associations" className="text-blue-600 hover:text-blue-700 text-xs">View all →</Link>
        </div>
        {recentApprovals.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-6 text-sm">No pending approvals</p>
        ) : (
          <div className="space-y-2">
            {recentApprovals.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white truncate">{approval.user.email}</p>
                  <p className="text-gray-500 dark:text-gray-400 truncate">{approval.user.association?.name || '-'}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${approval.user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                    {approval.user.role}
                  </span>
                  {approval.user.emailVerified ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <QuickLink href="/admin/associations" icon="🏢" label="Associations" />
        <QuickLink href="/admin/settlements" icon="💰" label="Settlements" />
        <QuickLink href="/admin/tenants" icon="🏠" label="Tenants" />
        <QuickLink href="/admin/modules" icon="🧩" label="Modules" />
        <QuickLink href="/admin/action-logs" icon="📋" label="Logs" />
        <QuickLink href="/admin/settings" icon="⚙️" label="Settings" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, href }: { label: string; value: number; icon: string; color?: 'green' | 'yellow' | 'red'; href?: string; }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  };

  const content = (
    <div className={`rounded-lg p-2.5 sm:p-3 border ${color ? colorClasses[color] : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} ${href ? 'hover:shadow-md transition cursor-pointer' : ''}`}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm sm:text-base">{icon}</span>
        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{label}</span>
      </div>
      <p className={`text-lg sm:text-xl font-bold ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'yellow' ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-1 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
      <span className="text-lg sm:text-xl">{icon}</span>
      <span className="font-medium text-gray-900 dark:text-white text-[9px] sm:text-xs text-center">{label}</span>
    </Link>
  );
}
