import { Badge } from '@mantine/core';

type Tone = { color: string; label: string };

/** One place that turns an Ajo status into words and a colour, so the same status always looks the same. */
const TONES: Record<string, Tone> = {
  // groups
  DRAFT: { color: 'gray', label: 'Draft' },
  OPEN: { color: 'blue', label: 'Open for joining' },
  ACTIVE: { color: 'green', label: 'Running' },
  COMPLETED: { color: 'teal', label: 'Completed' },
  CANCELLED: { color: 'gray', label: 'Cancelled' },
  // memberships
  PENDING: { color: 'yellow', label: 'Waiting for approval' },
  SUSPENDED: { color: 'orange', label: 'Suspended' },
  LEFT: { color: 'gray', label: 'Left' },
  // instalments
  DUE: { color: 'blue', label: 'Due' },
  PARTIAL: { color: 'yellow', label: 'Part paid' },
  PAID: { color: 'green', label: 'Paid' },
  OVERDUE: { color: 'red', label: 'Overdue' },
  WAIVED: { color: 'gray', label: 'Waived' },
  // payments
  REPORTED: { color: 'yellow', label: 'Waiting to be confirmed' },
  CASH_RECEIVED: { color: 'yellow', label: 'Cash received, awaiting confirmation' },
  CONFIRMED: { color: 'green', label: 'Confirmed' },
  REVERSED: { color: 'gray', label: 'Reversed' },
  REJECTED: { color: 'red', label: 'Turned down' },
  // late fees
  PAYABLE: { color: 'orange', label: 'To pay' },
  // verification
  NOT_REQUESTED: { color: 'gray', label: 'Not started' },
  VERIFIED: { color: 'green', label: 'Verified' },
  // disputes
  UPHELD: { color: 'green', label: 'Accepted' },
  NOT_UPHELD: { color: 'gray', label: 'Not accepted' },
  // trust
  EXCELLENT: { color: 'green', label: 'Excellent' },
  GOOD: { color: 'teal', label: 'Good' },
  FAIR: { color: 'yellow', label: 'Fair' },
  AT_RISK: { color: 'red', label: 'At risk' },
  NO_HISTORY: { color: 'gray', label: 'No history yet' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[status] ?? { color: 'gray', label: status };
  return (
    <Badge color={tone.color} variant="light" radius="sm">
      {label ?? tone.label}
    </Badge>
  );
}
