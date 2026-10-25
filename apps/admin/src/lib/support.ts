// Tier 2 support tickets — association admins asking SocietyLedger. Mirrors the API's /api/admin/support shapes.

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_USER' | 'WAITING_ON_STAFF' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'ACCESS' | 'PAYMENTS' | 'REPORTS' | 'MEMBERS' | 'TECHNICAL' | 'BUG' | 'FEATURE_REQUEST' | 'BILLING' | 'DATA' | 'OTHER';

export interface Person {
  id: number;
  email: string;
  member?: { firstName: string; lastName: string } | null;
}

export interface TicketAttachment {
  id: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface TicketReply {
  id: number;
  message: string;
  /** From SocietyLedger support. False means the association admin (the customer). */
  isStaff: boolean;
  /** A note only SocietyLedger staff can see. */
  isInternal: boolean;
  createdAt: string;
  user?: Person;
  attachments?: TicketAttachment[];
}

export interface PlatformTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  association: { id: number; name: string; subdomain: string };
  user?: Person;
  assignedTo?: Person | null;
  /** Began as an officer escalating a member's ticket (the member's ticket itself is never shown here). */
  isEscalation?: boolean;
  responses?: TicketReply[];
  attachments?: TicketAttachment[];
  _count?: { responses: number; attachments: number };
}

export interface PlatformTicketList {
  tickets: PlatformTicket[];
  total: number;
  hasMore: boolean;
}

export interface PlatformStats {
  total: number;
  open: number;
  waitingOnStaff: number;
  waitingOnUser: number;
  resolved: number;
  closed: number;
  unassigned: number;
}

export const OPEN_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'WAITING_ON_STAFF'];

/** SocietyLedger's side of the table: "customer" is the association admin who opened the ticket. */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on customer',
  WAITING_ON_STAFF: 'Waiting on us',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'cyan',
  WAITING_ON_USER: 'yellow',
  WAITING_ON_STAFF: 'orange',
  RESOLVED: 'green',
  CLOSED: 'gray',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = { LOW: 'gray', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red' };

export const PRIORITY_LABELS: Record<TicketPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

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

/** The moves the API allows (support.types.ts VALID_STATUS_TRANSITIONS) — the status control only offers these. */
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_USER', 'WAITING_ON_STAFF', 'RESOLVED', 'CLOSED'],
  WAITING_ON_USER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_STAFF: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export function personName(person?: Person | null): string {
  if (!person) return 'Unknown';
  return person.member ? `${person.member.firstName} ${person.member.lastName}` : person.email;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
