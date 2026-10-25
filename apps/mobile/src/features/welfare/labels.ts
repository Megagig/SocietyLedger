export type FilterOption = { label: string; value: string };

export const PAYOUT_TYPE_OPTIONS: FilterOption[] = [
  { label: 'Bereavement', value: 'BEREAVEMENT' },
  { label: 'Medical', value: 'MEDICAL' },
  { label: 'Education', value: 'EDUCATION' },
  { label: 'Emergency', value: 'EMERGENCY' },
  { label: 'Maternity', value: 'MATERNITY' },
  { label: 'Wedding', value: 'WEDDING' },
  { label: 'Other', value: 'OTHER' },
];

export const PAYOUT_TYPE_LABELS: Record<string, string> = Object.fromEntries(PAYOUT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

/** Contribution statuses (WelfareContributionStatus). */
export const CONTRIBUTION_STATUS_OPTIONS: FilterOption[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Rejected', value: 'REJECTED' },
];

/** Payout request statuses (WelfarePayoutStatus). */
export const PAYOUT_STATUS_OPTIONS: FilterOption[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Under review', value: 'UNDER_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Disbursed', value: 'DISBURSED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];
