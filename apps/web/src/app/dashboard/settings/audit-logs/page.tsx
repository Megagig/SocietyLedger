'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Filter, Download, Loader2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '@/lib/axios';
import { format } from 'date-fns';

interface AuditLog {
  id: number;
  userId: number;
  action: string;
  tableName: string;
  recordId?: number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  createdAt: string;
  user?: {
    email: string;
    member?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  SETTINGS_UPDATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ROLE_ASSIGNED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  ROLE_REMOVED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, tableFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);
      if (tableFilter) params.append('tableName', tableFilter);
      
      const response = await api.get(`/admin/audit-logs?${params}`);
      return response.data.data as AuditLogsResponse;
    },
  });

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return color;
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getUserName = (log: AuditLog) => {
    if (log.user?.member) {
      return `${log.user.member.firstName} ${log.user.member.lastName}`;
    }
    return log.user?.email || `User #${log.userId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" />
          Audit Logs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View all activity and changes in your association
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user or action..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
            <option value="SETTINGS">Settings</option>
            <option value="ROLE">Role Changes</option>
          </select>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">All Tables</option>
            <option value="users">Users</option>
            <option value="members">Members</option>
            <option value="transactions">Transactions</option>
            <option value="payments">Payments</option>
            <option value="settings">Settings</option>
            <option value="roles">Roles</option>
          </select>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Table
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Record ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {getUserName(log)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {log.tableName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {log.recordId || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!data?.logs || data.logs.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Audit Log Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {format(new Date(selectedLog.createdAt), 'MMMM d, yyyy HH:mm:ss')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User</dt>
                  <dd className="text-gray-900 dark:text-white">{getUserName(selectedLog)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Action</dt>
                  <dd>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(selectedLog.action)}`}>
                      {formatAction(selectedLog.action)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Table</dt>
                  <dd className="text-gray-900 dark:text-white">{selectedLog.tableName}</dd>
                </div>
                {selectedLog.recordId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Record ID</dt>
                    <dd className="text-gray-900 dark:text-white">{selectedLog.recordId}</dd>
                  </div>
                )}
                {selectedLog.oldValues && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Previous Values</dt>
                    <dd className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs text-red-700 dark:text-red-300">
                        {JSON.stringify(selectedLog.oldValues, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
                {selectedLog.newValues && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">New Values</dt>
                    <dd className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs text-green-700 dark:text-green-300">
                        {JSON.stringify(selectedLog.newValues, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
