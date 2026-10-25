/** Support tickets — `/api/support/*` and `/api/help/ai/*`. Verified 2026-10-22 against support.service.ts / support.controller.ts. */
import type { IsoDateString } from './common';

export type TicketCategory = 'ACCESS' | 'PAYMENTS' | 'REPORTS' | 'MEMBERS' | 'TECHNICAL' | 'BUG' | 'FEATURE_REQUEST' | 'BILLING' | 'DATA' | 'OTHER';
/** ASSOCIATION = a member asking their own association (Tier 1); PLATFORM = an association admin asking SocietyLedger (Tier 2). */
export type TicketAudience = 'ASSOCIATION' | 'PLATFORM';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_USER' | 'WAITING_ON_STAFF' | 'RESOLVED' | 'CLOSED';

/** What the API returns for a file — never the storage key; open one with `GET /support/attachments/:id`. */
export type TicketAttachmentDTO = {
  id: number;
  ticketId: number;
  responseId: number | null;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: IsoDateString;
};

type PersonDTO = { id: number; email: string; member?: { firstName: string; lastName: string } | null };

export type TicketResponseDTO = {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  /** True when the reply is from the association's support staff. */
  isStaff: boolean;
  /** A staff-only note. The API only ever returns these to staff. */
  isInternal?: boolean;
  createdAt: IsoDateString;
  user?: PersonDTO;
  attachments?: TicketAttachmentDTO[];
};

export type TicketDTO = {
  id: number;
  audience?: TicketAudience;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  resolvedAt: IsoDateString | null;
  closedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  user?: PersonDTO;
  assignedTo?: PersonDTO | null;
  /** Only on a single-ticket read. */
  responses?: TicketResponseDTO[];
  /** Files attached when the ticket was opened. Only on a single-ticket read. */
  attachments?: TicketAttachmentDTO[];
  _count?: { responses: number; attachments: number };
};

export type TicketListDTO = { tickets: TicketDTO[]; total: number; hasMore: boolean };

export type CreateTicketPayload = {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  aiCategory?: string;
  aiCategoryConfidence?: number;
  files?: { uri: string; name: string; type: string }[];
};

/** An officer escalating a member's ticket: they write the summary themselves, so nothing of the member's ticket is shared. */
export type EscalateTicketPayload = {
  subject: string;
  summary: string;
  category: TicketCategory;
  priority: TicketPriority;
  files?: { uri: string; name: string; type: string }[];
};

/** POST /help/ai/suggest-response — a draft reply for staff. */
export type ReplySuggestionDTO = { suggestion: string; confidence: number; tone: 'friendly' | 'professional' | 'apologetic'; sources: string[] };

/** POST /help/ai/categorize. `aiAvailable` is false when the AI service is off — the form then just works without suggestions. */
export type TicketCategorizationDTO = {
  category: TicketCategory;
  confidence: number;
  suggestedPriority: TicketPriority;
  reasoning: string;
  aiAvailable: boolean;
};
