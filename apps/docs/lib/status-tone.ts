/**
 * Status → tone mapping (`ui-tokens.md §1.4`, single source — `StatusChip`
 * reads this). Tones map to the `--color-fd-success/-warning/-error/-info`
 * variables already in `theme.css` (added at D1.2 for Fumadocs' own
 * Callout, reused here for the same semantics).
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneByStatus: Record<string, Tone> = {
  // positive
  paid: 'success',
  verified: 'success',
  confirmed: 'success',
  approved: 'success',
  active: 'success',
  present: 'success',
  posted: 'success',
  completed: 'success',
  disbursed: 'success',
  won: 'success',
  // pending
  pending: 'warning',
  partial: 'warning',
  submitted: 'warning',
  under_review: 'warning',
  nominations: 'warning',
  in_progress: 'warning',
  late: 'warning',
  due_soon: 'warning',
  // negative
  overdue: 'danger',
  failed: 'danger',
  rejected: 'danger',
  cancelled: 'danger',
  suspended: 'danger',
  absent: 'danger',
  defaulted: 'danger',
  // neutral
  draft: 'neutral',
  closed: 'neutral',
  inactive: 'neutral',
  excused: 'neutral',
  waived: 'neutral',
  archived: 'neutral',
  // scheduled
  scheduled: 'info',
  upcoming: 'info',
  voting_open: 'info',
  open: 'info',
};

export function statusTone(status: string): Tone {
  return toneByStatus[status.toLowerCase()] ?? 'neutral';
}
