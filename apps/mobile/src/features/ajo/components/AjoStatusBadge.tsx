import { Badge, type BadgeTone } from '@/components/ui/Badge';

type Entry = { tone: BadgeTone; label: string };

/** One place that turns an Ajo status into words and a tone, so the same status always looks the same (same words as the web). */
const ENTRIES: Record<string, Entry> = {
  // groups
  DRAFT: { tone: 'neutral', label: 'Draft' },
  OPEN: { tone: 'info', label: 'Open for joining' },
  ACTIVE: { tone: 'success', label: 'Running' },
  COMPLETED: { tone: 'success', label: 'Completed' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  // memberships
  PENDING: { tone: 'warning', label: 'Waiting for approval' },
  SUSPENDED: { tone: 'warning', label: 'Suspended' },
  LEFT: { tone: 'neutral', label: 'Left' },
  // instalments
  DUE: { tone: 'info', label: 'Due' },
  PARTIAL: { tone: 'warning', label: 'Part paid' },
  PAID: { tone: 'success', label: 'Paid' },
  OVERDUE: { tone: 'danger', label: 'Overdue' },
  WAIVED: { tone: 'neutral', label: 'Waived' },
  // payments
  REPORTED: { tone: 'warning', label: 'Waiting to be confirmed' },
  CASH_RECEIVED: { tone: 'warning', label: 'Cash received, awaiting confirmation' },
  CONFIRMED: { tone: 'success', label: 'Confirmed' },
  REVERSED: { tone: 'neutral', label: 'Reversed' },
  REJECTED: { tone: 'danger', label: 'Turned down' },
  // late fees
  PAYABLE: { tone: 'warning', label: 'To pay' },
  // verification
  NOT_REQUESTED: { tone: 'neutral', label: 'Not started' },
  VERIFIED: { tone: 'success', label: 'Verified' },
  // disputes
  UPHELD: { tone: 'success', label: 'Accepted' },
  NOT_UPHELD: { tone: 'neutral', label: 'Not accepted' },
  // trust
  EXCELLENT: { tone: 'success', label: 'Excellent' },
  GOOD: { tone: 'success', label: 'Good' },
  FAIR: { tone: 'warning', label: 'Fair' },
  AT_RISK: { tone: 'danger', label: 'At risk' },
  NO_HISTORY: { tone: 'neutral', label: 'No history yet' },
  // payouts and cases
  PREPARED: { tone: 'warning', label: 'Prepared' },
  APPROVED: { tone: 'info', label: 'Approved' },
  VOID: { tone: 'neutral', label: 'Voided' },
  PLAN_AGREED: { tone: 'info', label: 'Plan agreed' },
  RESOLVED: { tone: 'success', label: 'Resolved' },
  CLOSED_UNRESOLVED: { tone: 'neutral', label: 'Closed, not resolved' },
};

export function statusLabel(status: string): string {
  return ENTRIES[status]?.label ?? status;
}

export function AjoStatusBadge({ status, label }: { status: string; label?: string }) {
  const entry = ENTRIES[status] ?? { tone: 'neutral' as const, label: status };
  return <Badge tone={entry.tone}>{label ?? entry.label}</Badge>;
}
