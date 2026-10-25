import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

// ui-tokens.md §1.4 — the single source for status → tone. Keep in sync with that table.
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // positive (success)
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
  paid_off: 'success',
  resolved: 'success',
  accepted: 'success',
  // pending (warning)
  pending_guarantors: 'warning',
  waiting_on_user: 'warning',
  pending_review: 'warning',
  pending_approval: 'warning',
  pending: 'warning',
  partial: 'warning',
  submitted: 'warning',
  under_review: 'warning',
  nominations: 'warning',
  in_progress: 'warning',
  late: 'warning',
  due_soon: 'warning',
  // negative (danger)
  overdue: 'danger',
  failed: 'danger',
  rejected: 'danger',
  cancelled: 'danger',
  suspended: 'danger',
  absent: 'danger',
  defaulted: 'danger',
  declined: 'danger',
  // neutral
  written_off: 'neutral',
  released: 'neutral',
  draft: 'neutral',
  closed: 'neutral',
  inactive: 'neutral',
  excused: 'neutral',
  waived: 'neutral',
  archived: 'neutral',
  // scheduled (info)
  scheduled: 'info',
  upcoming: 'info',
  voting_open: 'info',
  open: 'info',
  matched: 'info',
};

const TONE_CLASSES: Record<StatusTone, { container: string; text: string }> = {
  success: { container: 'bg-success-soft', text: 'text-success' },
  warning: { container: 'bg-warning-soft', text: 'text-warning' },
  danger: { container: 'bg-danger-soft', text: 'text-danger' },
  neutral: { container: 'bg-surface-sunken', text: 'text-text-secondary' },
  info: { container: 'bg-info-soft', text: 'text-info' },
};

export function getStatusTone(status: string): StatusTone {
  return TONE_BY_STATUS[status.toLowerCase()] ?? 'neutral';
}

function humanize(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type StatusChipProps = {
  /** A real status value (e.g. 'overdue', 'in_progress') — looked up in ui-tokens.md §1.4's mapping. Unmapped values fall back to 'neutral' rather than throwing. */
  status: string;
  /** Overrides the auto-humanized label; the tone lookup still uses `status`. */
  label?: string;
  testID?: string;
};

export function StatusChip({ status, label, testID }: StatusChipProps) {
  const tone = getStatusTone(status);
  const toneClasses = TONE_CLASSES[tone];

  return (
    <View testID={testID} className={['h-6 flex-row items-center self-start rounded-sm px-2', toneClasses.container].join(' ')}>
      <Text variant="micro" className={toneClasses.text}>
        {label ?? humanize(status)}
      </Text>
    </View>
  );
}
