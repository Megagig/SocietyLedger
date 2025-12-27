'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import Link from 'next/link';

type AuditLog = {
  id: number;
  action: string;
  tableName: string;
  recordId: number | null;
  oldValues: any;
  newValues: any;
  createdAt: string;
  user: { id: number; email: string } | null;
  association: { id: number; name: string; subdomain: string } | null;
};

export default function AuditLogsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchLogs();
  }, [token, user, page, actionFilter]);

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (actionFilter) params.append('action', actionFilter);

      const res = await fetch(`${API_ROUTES.ADMIN.AUDIT_LOGS}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const result = await res.json();
      if (result.success) {
        setLogs(result.data.logs);
        setTotalPages(result.data.totalPages);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  const getActionColor = (action: string) => {
    if (action.includes('APPROVED') || action.includes('REACTIVATED') || action.includes('CREATE')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
    if (action.includes('REJECTED') || action.includes('SUSPENDED') || action.includes('DELETE')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    if (action.includes('UPDATE') || action.includes('IMPERSONATE')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Audit Logs</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Audit Logs
          </h1>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No audit logs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Association</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Table</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr 
                      key={log.id} 
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">
                        {log.user?.email || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {log.association?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {log.tableName}
                        {log.recordId && <span className="text-gray-400"> #{log.recordId}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-blue-600 hover:text-blue-700 text-xs">
                          {expandedLog === log.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        <td colSpan={6} className="py-4 px-4">
                          <div className="grid grid-cols-2 gap-4">
                            {log.oldValues && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Old Values</p>
                                <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 overflow-auto max-h-40">
                                  {JSON.stringify(log.oldValues, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newValues && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">New Values</p>
                                <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 overflow-auto max-h-40">
                                  {JSON.stringify(log.newValues, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
    </div>
  );
}
