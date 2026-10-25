import type { TicketCategory, TicketPriority, TicketStatus } from '@/types/api/support';

/** Same wording as the web ticket pages. */
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ACCESS: 'Access & Login',
  PAYMENTS: 'Payments',
  REPORTS: 'Reports',
  MEMBERS: 'Members',
  TECHNICAL: 'Technical',
  BUG: 'Bug Report',
  FEATURE_REQUEST: 'Feature Request',
  BILLING: 'Billing',
  DATA: 'Data',
  OTHER: 'Other',
};

const options = (values: TicketCategory[]) => values.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

/** What a member can raise with their association (Tier 1). */
export const CATEGORY_OPTIONS = options(['ACCESS', 'PAYMENTS', 'REPORTS', 'MEMBERS', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER']);

/** What an association admin can raise with SocietyLedger support (Tier 2) — the API accepts exactly these. */
export const PLATFORM_CATEGORY_OPTIONS = options(['ACCESS', 'BILLING', 'DATA', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER']);

export const PRIORITY_LABELS: Record<TicketPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

export const PRIORITY_OPTIONS = (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TicketPriority[]).map((value) => ({ value, label: PRIORITY_LABELS[value] }));

/** The member's point of view: "Waiting on you" means support is waiting for *them*. */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on you',
  WAITING_ON_STAFF: 'Waiting on support',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** The staff member's point of view on someone else's ticket: "Waiting on member" means the member owes the next reply. */
export const STAFF_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on member',
  WAITING_ON_STAFF: 'Needs reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** The status a staff member can move a ticket to next — mirrors the API's allowed transitions. */
export const STATUS_ACTIONS: Record<TicketStatus, { status: TicketStatus; label: string }[]> = {
  OPEN: [{ status: 'IN_PROGRESS', label: 'Start work' }, { status: 'RESOLVED', label: 'Resolve' }],
  IN_PROGRESS: [{ status: 'WAITING_ON_USER', label: 'Wait on member' }, { status: 'RESOLVED', label: 'Resolve' }],
  WAITING_ON_USER: [{ status: 'IN_PROGRESS', label: 'Back to work' }, { status: 'RESOLVED', label: 'Resolve' }],
  WAITING_ON_STAFF: [{ status: 'IN_PROGRESS', label: 'Start work' }, { status: 'RESOLVED', label: 'Resolve' }],
  RESOLVED: [{ status: 'CLOSED', label: 'Close' }, { status: 'OPEN', label: 'Reopen' }],
  CLOSED: [{ status: 'OPEN', label: 'Reopen' }],
};

/** Open, in progress and either waiting state are "open"; resolved and closed are done (and can be reopened). */
export function isOpenTicket(status: TicketStatus): boolean {
  return status !== 'RESOLVED' && status !== 'CLOSED';
}

/** Resolved or closed tickets can be reopened; open ones can be closed. */
export function canCloseTicket(status: TicketStatus): boolean {
  return isOpenTicket(status);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
