'use client';

import { useState, useEffect, useCallback } from 'react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { apiGet, apiPatch } from '@/utils/api';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MemberSnippet {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

interface ApprovalUser {
  id: number;
  email: string;
  role: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  member: MemberSnippet | null;
}

interface Approval {
  id: number;
  userId: number;
  approvalStatus: string;
  createdAt: string;
  approvalDate: string | null;
  rejectionReason: string | null;
  user: ApprovalUser;
  approvedBy: { id: number; email: string } | null;
}

type StatusFilter = 'pending' | 'approved' | 'rejected';

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  pending:  { label: 'Pending',  classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  approved: { label: 'Approved', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

export default function PendingApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: '20',
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      const response = await apiGet(`${API_ROUTES.MEMBERS.APPROVALS}?${params}`);
      const json = await response.json();
      if (json.success) {
        const d = json.data;
        setApprovals(d.approvals ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
      } else {
        toast.error(json.message || 'Failed to load approvals');
      }
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Reset to page 1 when search or status filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleApprove = async (userId: number, displayName: string) => {
    modals.openConfirmModal({
      title: 'Approve Member',
      children: (
        <Text size="sm">
          Approve <strong>{displayName}</strong>? They will be able to log in immediately.
        </Text>
      ),
      labels: { confirm: 'Approve', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => doAction(userId, 'approved'),
    });
  };

  const handleReject = async (userId: number, displayName: string) => {
    modals.open({
      title: 'Reject Registration',
      children: <RejectModal userId={userId} displayName={displayName} onDone={doReject} />,
    });
  };

  const doAction = async (userId: number, status: 'approved' | 'rejected', rejectionReason?: string) => {
    setActionLoading(userId);
    try {
      const response = await apiPatch(API_ROUTES.MEMBERS.APPROVAL_BY_ID(userId), { status, rejectionReason });
      const json = await response.json();
      if (json.success) {
        toast.success(status === 'approved' ? 'Member approved' : 'Registration rejected');
        fetchApprovals();
      } else {
        toast.error(json.message || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const doReject = (userId: number, reason?: string) => {
    modals.closeAll();
    doAction(userId, 'rejected', reason);
  };

  return (
    <Can permission={PERMISSIONS.MEMBER_EDIT_ALL} fallback={
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        You don&apos;t have permission to manage member approvals.
      </div>
    }>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Approvals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and approve self-registered members before they can log in.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {(['pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : approvals.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {statusFilter === 'pending' ? 'No pending approvals' : `No ${statusFilter} registrations`}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {statusFilter === 'pending'
                  ? 'All self-registered members have been reviewed.'
                  : `No members with ${statusFilter} status found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Member</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Registered</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                    {statusFilter === 'pending' && (
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
                    )}
                    {statusFilter === 'rejected' && (
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Reason</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {approvals.map((approval) => {
                    const member = approval.user.member;
                    const displayName = member
                      ? `${member.firstName} ${member.lastName}`
                      : approval.user.email;
                    const badge = STATUS_BADGE[approval.approvalStatus] ?? STATUS_BADGE.pending;

                    return (
                      <tr
                        key={approval.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30
                              flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
                              {member && (
                                <p className="text-xs text-gray-400">{member.memberId}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate max-w-[180px]">{approval.user.email}</span>
                          </div>
                          {!approval.user.emailVerified && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">Email not verified</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(approval.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>
                        {statusFilter === 'pending' && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                disabled={actionLoading === approval.user.id}
                                onClick={() => handleApprove(approval.user.id, displayName)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                                  bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400
                                  hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                {actionLoading === approval.user.id ? '…' : 'Approve'}
                              </button>
                              <button
                                disabled={actionLoading === approval.user.id}
                                onClick={() => handleReject(approval.user.id, displayName)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg
                                  bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400
                                  hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                        {statusFilter === 'rejected' && (
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
                            {approval.rejectionReason || '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{total} total</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Can>
  );
}

function RejectModal({
  userId,
  displayName,
  onDone,
}: {
  userId: number;
  displayName: string;
  onDone: (userId: number, reason?: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-4">
      <Text size="sm" c="dimmed">
        Rejecting <strong>{displayName}</strong>. They will be notified by email.
      </Text>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Rejection reason <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Not a recognised member of this association"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none
            focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => modals.closeAll()}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onDone(userId, reason.trim() || undefined)}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600
            hover:bg-red-700 rounded-lg transition-colors"
        >
          Confirm Reject
        </button>
      </div>
    </div>
  );
}
