'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconTicket,
  IconSearch,
  IconFilter,
  IconChevronRight,
  IconClock,
  IconUser,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconRefresh,
  IconChartBar,
  IconTrendingUp,
  IconMessage,
} from '@tabler/icons-react';
import {
  listTickets,
  getTicketStats,
  SupportTicket,
  TicketStats,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@/lib/api/support';

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  WAITING_ON_USER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WAITING_ON_STAFF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, categoryFilter, page]);

  async function loadData() {
    setLoading(true);
    try {
      const [ticketResult, statsResult] = await Promise.all([
        listTickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          category: categoryFilter || undefined,
          search: searchQuery || undefined,
          limit,
          offset: (page - 1) * limit,
        }),
        getTicketStats(),
      ]);
      setTickets(ticketResult.tickets);
      setTotal(ticketResult.total);
      setHasMore(ticketResult.hasMore);
      setStats(statsResult);
    } catch (error) {
      console.error('Failed to load support data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadData();
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatStatus(status: TicketStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function getUserName(ticket: SupportTicket): string {
    if (ticket.user?.member) {
      return `${ticket.user.member.firstName} ${ticket.user.member.lastName}`;
    }
    return ticket.user?.email || 'Unknown';
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-0">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 mb-3 sm:mb-4 text-sm"
        >
          <IconArrowLeft size={18} />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Support Ticket Management</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage and respond to support tickets from members
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 flex-shrink-0"
            title="Refresh"
          >
            <IconRefresh size={20} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <IconTicket size={16} />
              <span className="text-xs">Total</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <IconAlertCircle size={16} />
              <span className="text-xs">Open</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
              <IconClock size={16} />
              <span className="text-xs">In Progress</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <IconMessage size={16} />
              <span className="text-xs">Waiting</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.waitingOnStaff + stats.waitingOnUser}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <IconCheck size={16} />
              <span className="text-xs">Resolved</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <IconTrendingUp size={16} />
              <span className="text-xs">Avg Response</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avgResponseTimeHours ? `${Math.round(stats.avgResponseTimeHours)}h` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as TicketStatus | '');
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_ON_USER">Waiting on User</option>
              <option value="WAITING_ON_STAFF">Waiting on Staff</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as TicketPriority | '');
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as TicketCategory | '');
                setPage(1);
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">All Categories</option>
              <option value="ACCESS">Access</option>
              <option value="PAYMENTS">Payments</option>
              <option value="REPORTS">Reports</option>
              <option value="MEMBERS">Members</option>
              <option value="TECHNICAL">Technical</option>
              <option value="BUG">Bug</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading tickets...</p>
          </div>
        ) : tickets.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-3 sm:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{ticket.ticketNumber}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{ticket.subject}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[ticket.status]}`}>
                      {formatStatus(ticket.status)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <IconUser size={14} />
                      <span className="truncate max-w-[120px]">{getUserName(ticket)}</span>
                    </div>
                    <span>•</span>
                    <span>{ticket.category.replace(/_/g, ' ')}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-gray-400">{ticket._count?.responses || 0} responses</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(ticket.createdAt)}</span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <Link
                      href={`/dashboard/help/tickets/${ticket.id}`}
                      className="text-teal-600 dark:text-teal-400 hover:underline flex items-center justify-center gap-1 text-sm w-full py-1"
                    >
                      View Ticket
                      <IconChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Responses</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{ticket.ticketNumber}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{ticket.subject}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <IconUser size={16} className="text-gray-500" />
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{getUserName(ticket)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {ticket.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                          {formatStatus(ticket.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {ticket._count?.responses || 0}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/help/tickets/${ticket.id}`}
                          className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                          View
                          <IconChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                    className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center">
            <IconTicket size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tickets found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {statusFilter || priorityFilter || categoryFilter || searchQuery
                ? 'Try adjusting your filters'
                : 'No support tickets have been created yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
