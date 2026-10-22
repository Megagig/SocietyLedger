'use client';

import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconAlertTriangle, IconSend } from '@tabler/icons-react';
import {
  escalateTicket,
  PLATFORM_CATEGORIES,
  SupportTicket,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TicketCategory,
  TicketPriority,
} from '@/lib/api/support';
import { AttachmentPicker } from '@/components/support/AttachmentPicker';
import { toast } from '@/lib/toast';

interface EscalateTicketModalProps {
  opened: boolean;
  onClose: () => void;
  /** The member's ticket being escalated — only its number and subject are used, to prefill and to label. */
  ticket: Pick<SupportTicket, 'id' | 'ticketNumber' | 'subject'>;
  onEscalated: (platformTicket: SupportTicket) => void;
}

/**
 * An officer escalates a member's ticket to SocietyLedger support. This opens a *new* ticket in the officer's own
 * words — the member's ticket and its details are not shared, and the member is not told.
 */
export function EscalateTicketModal({ opened, onClose, ticket, onEscalated }: EscalateTicketModalProps) {
  const [subject, setSubject] = useState(`Escalation: ${ticket.subject}`.slice(0, 200));
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<TicketCategory>('OTHER');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (subject.trim().length < 5) return setError('Give the ticket a subject of at least 5 characters');
    if (summary.trim().length < 10) return setError('Describe the problem in at least 10 characters');

    setSubmitting(true);
    try {
      const created = await escalateTicket(ticket.id, { subject: subject.trim(), summary: summary.trim(), category, priority }, files);
      if (created.attachmentError) toast.error(created.attachmentError);
      toast.success(`Sent to SocietyLedger support as ${created.ticketNumber}`);
      onEscalated(created);
    } catch (err: any) {
      setError(err.message || 'Failed to escalate ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Escalate to SocietyLedger support" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This opens a new ticket with SocietyLedger&apos;s support team. Only what you write below is shared — not {ticket.ticketNumber} or the
          member&apos;s details — and the member isn&apos;t told. A note is left on the original ticket.
        </p>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <IconAlertTriangle size={16} />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What do you need SocietyLedger to look into?</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="Describe the problem in your own words, without member names or personal details."
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {PLATFORM_CATEGORIES.map((value) => (
                <option key={value} value={value}>{TICKET_CATEGORY_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <AttachmentPicker files={files} onChange={setFiles} disabled={submitting} />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <IconSend size={16} />
            {submitting ? 'Sending...' : 'Escalate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
