import type { AssignmentStatus, CampaignAssignmentDTO, CampaignStatus, CategoryDTO, CategoryFrequency, CategoryKind } from '@/types/api/financeSetup';

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  due: 'Dues',
  levy: 'Levies',
  donation: 'Donations',
  penalty: 'Penalties',
};

/** The singular, for a single row or a form ("Due", "Levy"). */
export const CATEGORY_KIND_SINGULAR: Record<CategoryKind, string> = {
  due: 'Due',
  levy: 'Levy',
  donation: 'Donation',
  penalty: 'Penalty',
};

export const CATEGORY_KIND_OPTIONS: CategoryKind[] = ['due', 'levy', 'donation', 'penalty'];

export const FREQUENCY_LABELS: Record<CategoryFrequency, string> = {
  'one-time': 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export const FREQUENCY_OPTIONS = (Object.keys(FREQUENCY_LABELS) as CategoryFrequency[]).map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

/** "Monthly" or "Monthly · default ₦5,000.00" is built by the row; this is just the frequency, or null. */
export function frequencyLabel(frequency: string | null): string | null {
  return frequency ? (FREQUENCY_LABELS[frequency as CategoryFrequency] ?? frequency) : null;
}

/** How many charges and campaigns use a category, in words. */
export function categoryUsageLabel(usageCount: number): string {
  if (usageCount === 0) return 'Not used yet';
  return `Used by ${usageCount} ${usageCount === 1 ? 'charge or campaign' : 'charges and campaigns'}`;
}

/** The type can't change once anything uses the category (the API refuses it). */
export const categoryTypeLocked = (category: Pick<CategoryDTO, 'usageCount'> | null | undefined): boolean => !!category && category.usageCount > 0;

// ---------------------------------------------------------------- levy campaigns

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** The key `StatusChip` understands for a campaign. */
export const campaignStatusKey = (status: CampaignStatus): string => status.toLowerCase();

/** Only an active campaign takes new members. */
export const campaignCanAssign = (status: CampaignStatus): boolean => status === 'ACTIVE';

/** Closing stops new members; only an active campaign can be closed. */
export const campaignCanClose = (status: CampaignStatus): boolean => status === 'ACTIVE';

/** Editing the details is for a campaign still running or just closed; a completed or cancelled one is history. */
export const campaignCanEdit = (status: CampaignStatus): boolean => status === 'DRAFT' || status === 'ACTIVE' || status === 'CLOSED';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  pending: 'Unpaid',
};

/** Removing an assignment corrects a mistake, so it is only offered while the member has paid nothing. */
export const assignmentCanRemove = (assignment: Pick<CampaignAssignmentDTO, 'paidAmount'>): boolean => assignment.paidAmount <= 0;

/** "12 days left", "Due today", "3 days overdue". Based on whole days from today. */
export function deadlineLabel(deadline: string, now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return 'Due today';
  if (days > 0) return days === 1 ? '1 day left' : `${days} days left`;
  const late = Math.abs(days);
  return late === 1 ? '1 day overdue' : `${late} days overdue`;
}

/** What a closed campaign still has outstanding, in words — the debt does not go away when the campaign closes. */
export function stillOwedLine(unpaidMembers: number, closed: boolean): string {
  if (unpaidMembers <= 0) return 'Everyone assigned has paid.';
  const who = `${unpaidMembers} ${unpaidMembers === 1 ? 'member still owes' : 'members still owe'}`;
  return closed ? `${who} this levy. Their charges stay owed and keep being reminded until paid, waived or voided.` : `${who} this levy.`;
}

/** The toast after assigning: how many got a charge, and how many were already in. */
export function assignOutcomeSummary(result: { assigned: number; skipped: number }): string {
  const parts = [`Assigned ${result.assigned} ${result.assigned === 1 ? 'member' : 'members'}`];
  if (result.skipped > 0) parts.push(`${result.skipped} already in the campaign`);
  return parts.join(' · ');
}
