'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type ActionLog = {
  id: number;
  actorId: number;
  actorRole: string;
  actionType: string;
  targetType: string;
  targetId: number | null;
  associationId: number | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor?: { email: string };
  association?: { name: string };
};

type LogStats = {
  totalActions: number;
  actionsByType: { type: string; count: number }[];
  actionsByTarget: { target: string; count: number }[];
};

export default function ActionLogsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [actionType, setActionType] = useState('');
  const [targetType, setTargetType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, page, actionType, targetType, startDate, endDate]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (actionType) params.append('actionType', actionType);
      if (targetType) params.append('targetType', targetType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_ROUTES.PLATFORM_ADMIN.ACTION_LOGS}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.PLATFORM_ADMIN.ACTION_LOGS_STATS, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const [logsData, statsData] = await Promise.all([logsRes.json(), statsRes.json()]);

      if (logsData.success) {
        setLogs(logsData.data.logs || []);
        setTotalPages(logsData.data.pagination?.totalPages || 1);
      }
      if (statsData.success) setStats(statsData.data);
    } catch (e) {
      console.error('Failed to fetch action logs:', e);
      toast.error('Failed to load action logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionType) params.append('actionType', actionType);
      if (targetType) params.append('targetType', targetType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`${API_ROUTES.PLATFORM_ADMIN.ACTION_LOGS_EXPORT}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `action-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Export downloaded');
      } else {
        toast.error('Export failed');
      }
    } catch (e) {
      toast.error('Export failed');
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  const actionTypes = ['TENANT_SUSPEND', 'TENANT_REACTIVATE', 'TENANT_SOFT_DELETE', 'TENANT_RESTORE', 
    'TENANT_FORCE_LOGOUT', 'MODULE_OVERRIDE', 'FEATURE_OVERRIDE', 'BILLING_OVERRIDE', 'SECURITY_UPDATE'];
  const targetTypes = ['association', 'module', 'feature', 'billing', 'security'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Action Logs</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Action Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Audit trail of all platform admin actions</p>
        </div>
        <button onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Export CSV
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Actions</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalActions}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Action Types</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.actionsByType?.length || 0}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Target Types</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.actionsByTarget?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <select value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All Actions</option>
          {actionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">All Targets</option>
          {targetTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        {(actionType || targetType || startDate || endDate) && (
          <button onClick={() => { setActionType(''); setTargetType(''); setStartDate(''); setEndDate(''); setPage(1); }}
            className="text-sm text-blue-600 hover:text-blue-700">Clear Filters</button>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No action logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Timestamp</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Actor</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Target</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Association</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 dark:text-white text-xs">{log.actor?.email || `User #${log.actorId}`}</div>
                      <div className="text-gray-500 text-xs">{log.actorRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {log.actionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-xs">
                      {log.targetType} {log.targetId && `#${log.targetId}`}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-xs">
                      {log.association?.name || (log.associationId ? `#${log.associationId}` : '-')}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                      {log.reason || '-'}
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
