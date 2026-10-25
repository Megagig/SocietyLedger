'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconTicket,
  IconPlus,
  IconSearch,
  IconFilter,
  IconChevronRight,
  IconClock,
  IconUser,
  IconRefresh,
} from '@tabler/icons-react';
import {
  listTickets,
  SupportTicket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  MEMBER_CATEGORIES,
  PLATFORM_CATEGORIES,
} from '@/lib/api/support';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { HelpLink } from '@/components/docs/HelpLink';

export default function TicketsPage() {
  const { can } = usePermissions();
  const canEscalate = can(PERMISSIONS.SUPPORT_ESCALATE);
  const isStaff = can(PERMISSIONS.SUPPORT_VIEW_ALL);
  // Association admins have two lists: the member tickets they handle, and their own tickets to SocietyLedger.
  const [scope, setScope] = useState<'association' | 'platform'>('association');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [needsReply, setNeedsReply] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;

  // Staff: how many member tickets are waiting on a first answer.
  useEffect(() => {
    if (!isStaff) return;
    listTickets({ status: 'OPEN' as TicketStatus, limit: 1, offset: 0 })
      .then((r) => setNeedsReply(r.total))
      .catch(() => setNeedsReply(0));
  }, [isStaff, tickets]);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, categoryFilter, priorityFilter, page, scope]);

  async function loadTickets() {
    setLoading(true);
    try {
      const result = await listTickets({
        audience: scope === 'platform' ? 'PLATFORM' : undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        search: search || undefined,
        limit,
        offset: page * limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setTickets(result.tickets);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    loadTickets();
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setPage(0);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getUserName(ticket: SupportTicket): string {
    if (ticket.user?.member) {
      return `${ticket.user.member.firstName} ${ticket.user.member.lastName}`;
    }
    return ticket.user?.email || 'Unknown';
  }

  const categoryOptions = (scope === 'platform' ? PLATFORM_CATEGORIES : MEMBER_CATEGORIES).map((value) => [value, TICKET_CATEGORY_LABELS[value]] as const);

  const statusColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            {isStaff ? (scope === 'platform' ? 'Tickets to SocietyLedger' : 'Member Support Tickets') : 'Support Tickets'}
          </h1>
            <HelpLink />
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {isStaff
              ? scope === 'platform'
                ? 'Tickets you sent to the SocietyLedger team'
                : 'Tickets raised by your members — open one to reply, assign it or change its status'
              : 'View and manage your support requests'}
            {isStaff && scope === 'association' && needsReply > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {needsReply} need a reply
              </span>
            )}
          </p>
        </div>
        <Link
          href={scope === 'platform' ? '/dashboard/help/tickets/new?to=platform' : '/dashboard/help/tickets/new'}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <IconPlus size={20} />
          {scope === 'platform' ? 'Contact SocietyLedger' : 'New Ticket'}
        </Link>
      </div>

      {/* Which list: member tickets I handle, or my own tickets to SocietyLedger (association admins only) */}
      {canEscalate && (
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6 bg-white dark:bg-gray-800">
          {([['association', 'Association tickets'], ['platform', 'Contact SocietyLedger']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setScope(value);
                setCategoryFilter('');
                setPage(0);
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scope === value ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || statusFilter || categoryFilter || priorityFilter
                ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <IconFilter size={20} />
            Filters
          </button>
          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter Options */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as TicketStatus | ''); setPage(0); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">All Statuses</option>
                {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value as TicketCategory | ''); setPage(0); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">All Categories</option>
                {categoryOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value as TicketPriority | ''); setPage(0); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">All Priorities</option>
                {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {(statusFilter || categoryFilter || priorityFilter) && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <IconRefresh size={16} />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <IconTicket size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tickets found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {search || statusFilter || categoryFilter || priorityFilter
                ? 'Try adjusting your filters'
                : "You haven't created any support tickets yet"}
            </p>
            <Link
              href="/dashboard/help/tickets/new"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <IconPlus size={20} />
              Create Your First Ticket
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/help/tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {ticket.ticketNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[getStatusColor(ticket.status)]}`}>
                        {getStatusLabel(ticket.status, isStaff && scope === 'association')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[getPriorityColor(ticket.priority)]}`}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </span>
                      {ticket.aiEscalationRecommended && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Needs Attention
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <IconUser size={14} />
                        {getUserName(ticket)}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconClock size={14} />
                        {formatDate(ticket.createdAt)}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {TICKET_CATEGORY_LABELS[ticket.category]}
                      </span>
                      {ticket._count && ticket._count.responses > 0 && (
                        <span className="text-xs">
                          {ticket._count.responses} {ticket._count.responses === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {(page > 0 || hasMore) && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} tickets
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
