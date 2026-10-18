'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  IconPlus, 
  IconSearch, 
  IconFilter,
  IconChecklist,
  IconUsers,
  IconCalendarEvent,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconPlayerStop,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { getElections, deleteElection, Election, ElectionStatus, ElectionType } from '@/lib/api/voting';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';

// Helper functions
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

// Status badge component
function StatusBadge({ status }: { status: ElectionStatus }) {
  const statusConfig: Record<ElectionStatus, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
    NOMINATIONS_OPEN: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Nominations Open' },
    VOTING_OPEN: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Voting Open' },
    VOTING_CLOSED: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Voting Closed' },
    RESULTS_PUBLISHED: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Results Published' },
    CANCELLED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Cancelled' },
  };

  const config = statusConfig[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// Election type badge
function TypeBadge({ type }: { type: ElectionType }) {
  const typeConfig: Record<ElectionType, { color: string; label: string }> = {
    GENERAL: { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', label: 'General' },
    EXECUTIVE: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', label: 'Executive Committee' },
    COMMITTEE: { color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', label: 'Committee Member' },
    SPECIAL: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', label: 'Special Purpose' },
  };

  const config = typeConfig[type];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function ElectionsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ElectionStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ElectionType | ''>('');
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['elections', { page, search, status: statusFilter, electionType: typeFilter }],
    queryFn: () => getElections({ 
      page, 
      limit: 10, 
      search: search || undefined,
      status: statusFilter || undefined,
      electionType: typeFilter || undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteElection,
    onSuccess: () => {
      toast.success('Election deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['elections'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Election',
      children: <Text size="sm">Are you sure you want to delete this election? This action cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteMutation.mutate(id);
      },
    });
    setOpenMenu(null);
  };

  const elections = data?.data?.elections || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Elections</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage elections, positions, and candidates</p>
        </div>
        <Link
          href="/dashboard/governance/elections/new"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto"
        >
          <IconPlus size={18} />
          New Election
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="relative">
            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search elections..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ElectionStatus | ''); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="NOMINATIONS_OPEN">Nominations Open</option>
              <option value="VOTING_OPEN">Voting Open</option>
              <option value="VOTING_CLOSED">Voting Closed</option>
              <option value="RESULTS_PUBLISHED">Results Published</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as ElectionType | ''); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="GENERAL">General</option>
              <option value="EXECUTIVE">Executive Committee</option>
              <option value="COMMITTEE">Committee Member</option>
              <option value="SPECIAL">Special Purpose</option>
            </select>
          </div>
        </div>
      </div>

      {/* Elections List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load elections. Please try again.</p>
        </div>
      ) : elections.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <IconChecklist size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No elections found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {search || statusFilter || typeFilter 
              ? 'Try adjusting your filters'
              : 'Get started by creating your first election'}
          </p>
          {!search && !statusFilter && !typeFilter && (
            <Link
              href="/dashboard/governance/elections/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <IconPlus size={18} />
              Create Election
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map((election: Election) => (
            <div
              key={election.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Link 
                      href={`/dashboard/governance/elections/${election.id}`}
                      className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 truncate"
                    >
                      {election.title}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={election.status} />
                      <TypeBadge type={election.electionType} />
                    </div>
                  </div>
                  {election.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{election.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <IconUsers size={14} />
                      {election._count?.positions || 0} positions
                    </span>
                    {election.votingStartDate && (
                      <span className="flex items-center gap-1">
                        <IconChecklist size={14} />
                        <span className="hidden sm:inline">Voting:</span> {formatDate(election.votingStartDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === election.id ? null : election.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <IconDotsVertical size={20} className="text-gray-500" />
                  </button>
                  {openMenu === election.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                      <Link
                        href={`/dashboard/governance/elections/${election.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setOpenMenu(null)}
                      >
                        <IconChecklist size={16} />
                        View Details
                      </Link>
                      {election.status === 'DRAFT' && (
                        <Link
                          href={`/dashboard/governance/elections/${election.id}/edit`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setOpenMenu(null)}
                        >
                          <IconEdit size={16} />
                          Edit
                        </Link>
                      )}
                      {(election.status === 'VOTING_CLOSED' || election.status === 'RESULTS_PUBLISHED') && (
                        <Link
                          href={`/dashboard/governance/elections/${election.id}/results`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setOpenMenu(null)}
                        >
                          <IconCheck size={16} />
                          View Results
                        </Link>
                      )}
                      {election.status === 'DRAFT' && (
                        <button
                          onClick={() => handleDelete(election.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
                        >
                          <IconTrash size={16} />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
            Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, pagination.total)} of {pagination.total} elections
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
