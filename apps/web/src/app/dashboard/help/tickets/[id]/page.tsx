'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconSend,
  IconClock,
  IconUser,
  IconCheck,
  IconX,
  IconRefresh,
  IconSparkles,
  IconLock,
} from '@tabler/icons-react';
import {
  getTicket,
  addResponse,
  closeTicket,
  reopenTicket,
  SupportTicket,
  TicketResponse,
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  updateTicket,
  suggestResponse,
  TicketStatus,
} from '@/lib/api/support';
import { EscalateTicketModal } from '@/components/support/EscalateTicketModal';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { modals } from '@mantine/modals';
import { AttachmentPicker } from '@/components/support/AttachmentPicker';
import { TicketAttachments } from '@/components/support/TicketAttachments';
import { toast } from '@/lib/toast';
import { Text } from '@mantine/core';
import { HelpLink } from '@/components/docs/HelpLink';

/** The status moves the API allows — the staff status control only offers these. */
const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_USER', 'WAITING_ON_STAFF', 'RESOLVED', 'CLOSED'],
  WAITING_ON_USER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_STAFF: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = parseInt(params.id as string);

  const { can, user } = usePermissions();
  const [internal, setInternal] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Response form
  const [newResponse, setNewResponse] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ticketId) {
      loadTicket();
    }
  }, [ticketId]);

  async function loadTicket() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTicket(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!newResponse.trim() || !ticket) return;

    setSubmitting(true);
    try {
      const result = await addResponse(ticket.id, newResponse.trim(), { files, isInternal: staffView && internal });
      setNewResponse('');
      setFiles([]);
      setInternal(false);
      if (result.attachmentError) toast.error(result.attachmentError);
      await loadTicket(); // Reload to get updated responses
    } catch (err: any) {
      setError(err.message || 'Failed to add response');
    } finally {
      setSubmitting(false);
    }
  }

  /** Staff: change status or take the ticket. Only support.manage may (the API enforces it too). */
  async function handleUpdate(changes: { status?: TicketStatus; assignedToId?: number | null }, done: string) {
    if (!ticket) return;
    setUpdating(true);
    try {
      await updateTicket(ticket.id, changes);
      toast.success(done);
      await loadTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  }

  /** Staff: a draft reply from the AI service, dropped into the reply box to edit. */
  async function handleSuggest() {
    if (!ticket) return;
    setSuggesting(true);
    try {
      const suggestion = await suggestResponse({ subject: ticket.subject, description: ticket.description, category: ticket.category });
      if (suggestion?.suggestion) setNewResponse(suggestion.suggestion);
      else toast.error('No suggestion available right now. Write your reply yourself.');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleCloseTicket() {
    if (!ticket) return;

    modals.openConfirmModal({
      title: 'Close Ticket',
      children: <Text size="sm">Are you sure you want to close this ticket?</Text>,
      labels: { confirm: 'Close Ticket', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await closeTicket(ticket.id);
          await loadTicket();
        } catch (err: any) {
          setError(err.message || 'Failed to close ticket');
        }
      },
    });
  }

  async function handleReopenTicket() {
    if (!ticket) return;

    try {
      await reopenTicket(ticket.id);
      await loadTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen ticket');
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getUserName(user?: { email: string; member?: { firstName: string; lastName: string } }): string {
    if (user?.member) {
      return `${user.member.firstName} ${user.member.lastName}`;
    }
    return user?.email || 'Unknown';
  }

  const statusColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/help/tickets"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <IconArrowLeft size={20} />
          Back to Tickets
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
          <IconX size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
            {error || 'Ticket not found'}
          </h2>
          <button
            onClick={loadTicket}
            className="mt-4 inline-flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <IconRefresh size={18} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  // A Tier 2 ticket is between this admin and SocietyLedger: here they are the customer, not staff.
  const isPlatformTicket = ticket.audience === 'PLATFORM';
  const staffView = can(PERMISSIONS.SUPPORT_VIEW_ALL) && !isPlatformTicket;
  const canEscalate = staffView && can(PERMISSIONS.SUPPORT_ESCALATE);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/help/tickets"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <IconArrowLeft size={20} />
          Back to Tickets
        </Link>
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                {ticket.ticketNumber}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[getStatusColor(ticket.status)]}`}>
                {getStatusLabel(ticket.status, staffView)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[getPriorityColor(ticket.priority)]}`}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </span>
              {isPlatformTicket && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  SocietyLedger support
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {ticket.subject}
            </h1>
              <HelpLink />
            </div>
          </div>
          
          <div className="flex gap-2">
            {canEscalate && !isClosed && (
              <button
                onClick={() => setEscalateOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <IconSparkles size={18} />
                Escalate to SocietyLedger
              </button>
            )}
            {isClosed ? (
              <button
                onClick={handleReopenTicket}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <IconRefresh size={18} />
                Reopen
              </button>
            ) : (
              <button
                onClick={handleCloseTicket}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <IconCheck size={18} />
                Close Ticket
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Created by</span>
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
              <IconUser size={14} />
              {getUserName(ticket.user)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Created</span>
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
              <IconClock size={14} />
              {formatRelativeTime(ticket.createdAt)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Category</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {TICKET_CATEGORY_LABELS[ticket.category]}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Last Updated</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatRelativeTime(ticket.updatedAt)}
            </span>
          </div>
        </div>

        {/* AI Analysis Badge */}
        {ticket.aiSentiment && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <IconSparkles size={16} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-purple-700 dark:text-purple-300">
              AI detected {ticket.aiSentiment} sentiment
              {ticket.aiEscalationRecommended && ' - Escalation recommended'}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{ticket.description}</p>
        </div>
        <TicketAttachments attachments={ticket.attachments} />
      </div>

      {/* Staff: handle the ticket */}
      {staffView && can(PERMISSIONS.SUPPORT_MANAGE) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Move to</label>
            <select
              value=""
              disabled={updating}
              onChange={(e) => e.target.value && handleUpdate({ status: e.target.value as TicketStatus }, 'Ticket updated')}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">{getStatusLabel(ticket.status, true)}</option>
              {NEXT_STATUSES[ticket.status].map((status) => (
                <option key={status} value={status}>{getStatusLabel(status, true)}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assigned to</span>
            {ticket.assignedTo?.id === user?.id ? (
              <span className="text-sm font-medium text-gray-900 dark:text-white">You</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">{getUserName(ticket.assignedTo) === 'Unknown' ? 'Not assigned yet' : getUserName(ticket.assignedTo)}</span>
                {user?.id && (
                  <button
                    onClick={() => handleUpdate({ assignedToId: user.id }, 'Assigned to you')}
                    disabled={updating}
                    className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Assign to me
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responses */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Responses ({ticket.responses?.length || 0})
          </h2>
        </div>

        {ticket.responses && ticket.responses.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {ticket.responses.map((response) => (
              <div
                key={response.id}
                className={`p-4 ${response.isInternal ? 'bg-yellow-50 dark:bg-yellow-900/10' : response.isStaff ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getUserName(response.user)}
                  </span>
                  {response.isStaff && (
                    <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs rounded">
                      {isPlatformTicket ? 'SocietyLedger' : 'Staff'}
                    </span>
                  )}
                  {response.isInternal && (
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded">
                      Internal note
                    </span>
                  )}
                  {response.isAiGenerated && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded flex items-center gap-1">
                      <IconSparkles size={10} />
                      AI Assisted
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(response.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {response.message}
                </p>
                <TicketAttachments attachments={response.attachments} />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No responses yet
          </div>
        )}
      </div>

      {/* Reply Form */}
      {isClosed ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 text-center">
          <IconLock size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            This ticket is closed. Reopen it to add a response.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmitResponse} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Add a Response
          </label>
          <textarea
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
            placeholder="Type your response..."
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none mb-4"
            maxLength={10000}
          />
          {staffView && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                Internal note — the member won&apos;t see it
              </label>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-60"
              >
                <IconSparkles size={14} />
                {suggesting ? 'Thinking...' : 'Suggest a reply'}
              </button>
            </div>
          )}
          <div className="mb-4">
            <AttachmentPicker files={files} onChange={setFiles} disabled={submitting} label="Attachments (optional)" />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newResponse.trim() || submitting}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Sending...
                </>
              ) : (
                <>
                  <IconSend size={18} />
                  Send Response
                </>
              )}
            </button>
          </div>
        </form>
      )}
      {ticket && canEscalate && (
        <EscalateTicketModal
          opened={escalateOpen}
          onClose={() => setEscalateOpen(false)}
          ticket={ticket}
          onEscalated={() => {
            setEscalateOpen(false);
            loadTicket();
          }}
        />
      )}
    </div>
  );
}
