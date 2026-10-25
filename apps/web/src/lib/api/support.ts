// ============================================
// PHASE 21: SUPPORT API CLIENT
// Frontend API functions for support tickets
// ============================================

import { API_ROUTES } from '@/utils/constants';

// ============================================
// TYPES
// ============================================

export type TicketCategory = 
  | 'ACCESS'
  | 'PAYMENTS'
  | 'REPORTS'
  | 'MEMBERS'
  | 'TECHNICAL'
  | 'BUG'
  | 'FEATURE_REQUEST'
  | 'BILLING'
  | 'DATA'
  | 'OTHER';

/** ASSOCIATION = a member asking their own association; PLATFORM = an association admin asking SocietyLedger. */
export type TicketAudience = 'ASSOCIATION' | 'PLATFORM';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus = 
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_USER'
  | 'WAITING_ON_STAFF'
  | 'RESOLVED'
  | 'CLOSED';

/** A file on a ticket or reply. Open one with `getAttachmentUrl` — the API never exposes the storage path. */
export interface TicketAttachment {
  id: number;
  ticketId: number;
  responseId: number | null;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  audience?: TicketAudience;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  // AI fields
  aiCategory: string | null;
  aiCategoryConfidence: number | null;
  aiSentiment: string | null;
  aiSentimentScore: number | null;
  aiEscalationRecommended: boolean;
  // Assignment
  assignedToId: number | null;
  // Timestamps
  resolvedAt: string | null;
  closedAt: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: {
    id: number;
    email: string;
    member?: {
      firstName: string;
      lastName: string;
    };
  };
  assignedTo?: {
    id: number;
    email: string;
    member?: {
      firstName: string;
      lastName: string;
    };
  };
  responses?: TicketResponse[];
  /** Files attached when the ticket was opened. Only on a single-ticket read. */
  attachments?: TicketAttachment[];
  _count?: {
    responses: number;
    attachments: number;
  };
}

export interface TicketResponse {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  isStaff: boolean;
  isInternal: boolean;
  isAiGenerated: boolean;
  aiConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  attachments?: TicketAttachment[];
  user?: {
    id: number;
    email: string;
    member?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface TicketListResult {
  tickets: SupportTicket[];
  total: number;
  hasMore: boolean;
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  waitingOnUser: number;
  waitingOnStaff: number;
  resolved: number;
  closed: number;
  avgResponseTimeHours: number | null;
  avgResolutionTimeHours: number | null;
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  aiCategory?: string;
  aiCategoryConfidence?: number;
  aiSentiment?: string;
  aiSentimentScore?: number;
}

export interface UpdateTicketData {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedToId?: number | null;
}

export interface CategorizationResult {
  category: TicketCategory;
  confidence: number;
  suggestedPriority: TicketPriority;
  reasoning: string;
  aiAvailable: boolean;
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  score: number;
  escalationRecommended: boolean;
  reasoning: string;
  aiAvailable: boolean;
}

export interface ResponseSuggestion {
  suggestion: string;
  confidence: number;
  tone: 'friendly' | 'professional' | 'apologetic';
  sources: string[];
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * List tickets
 */
export async function listTickets(params?: {
  audience?: TicketAudience;
  status?: TicketStatus | TicketStatus[];
  category?: TicketCategory;
  priority?: TicketPriority;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<TicketListResult> {
  const searchParams = new URLSearchParams();
  
  if (params?.audience) searchParams.set('audience', params.audience);
  if (params?.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => searchParams.append('status', s));
    } else {
      searchParams.set('status', params.status);
    }
  }
  if (params?.category) searchParams.set('category', params.category);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  
  const url = `${API_ROUTES.SUPPORT.TICKETS}?${searchParams.toString()}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to list tickets');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Create a new ticket
 */
export async function createTicket(
  ticketData: CreateTicketData,
  files: File[] = []
): Promise<SupportTicket & { attachmentError?: string }> {
  // With files it is multipart (the browser sets the boundary, so no Content-Type); without, plain JSON as before.
  let body: BodyInit;
  const headers: Record<string, string> = {};
  if (files.length > 0) {
    const form = new FormData();
    Object.entries(ticketData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    files.forEach((file) => form.append('files', file));
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(ticketData);
  }

  const response = await fetch(API_ROUTES.SUPPORT.TICKETS, {
    method: 'POST',
    headers,
    credentials: 'include',
    body,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to create ticket');
  }

  const data = await response.json();
  // The ticket exists even when its files could not be stored — the API says so in `attachmentError`.
  return { ...data.data, attachmentError: data.attachmentError };
}

/** POSTs a ticket body as JSON, or as multipart when files are attached (the browser sets the boundary). */
async function postTicketBody(url: string, fields: Record<string, unknown>, files: File[], failure: string): Promise<SupportTicket & { attachmentError?: string }> {
  let body: BodyInit;
  const headers: Record<string, string> = {};
  if (files.length > 0) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    files.forEach((file) => form.append('files', file));
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(fields);
  }

  const response = await fetch(url, { method: 'POST', headers, credentials: 'include', body });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || failure);
  }
  const data = await response.json();
  return { ...data.data, attachmentError: data.attachmentError };
}

/**
 * An association admin opens a ticket to SocietyLedger support (Tier 2).
 */
export async function createPlatformTicket(ticketData: CreateTicketData, files: File[] = []): Promise<SupportTicket & { attachmentError?: string }> {
  return postTicketBody(API_ROUTES.SUPPORT.PLATFORM_TICKETS, { ...ticketData }, files, 'Failed to contact SocietyLedger support');
}

/**
 * An officer escalates a member's ticket. Opens a new Tier 2 ticket from the officer's own summary — nothing of the
 * member's ticket is shared.
 */
export async function escalateTicket(
  ticketId: number,
  data: { subject: string; summary: string; category: TicketCategory; priority?: TicketPriority },
  files: File[] = []
): Promise<SupportTicket & { attachmentError?: string }> {
  return postTicketBody(API_ROUTES.SUPPORT.TICKET_ESCALATE(ticketId), { ...data }, files, 'Failed to escalate ticket');
}

/**
 * Get ticket by ID
 */
export async function getTicket(ticketId: number): Promise<SupportTicket> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_BY_ID(ticketId), {
    credentials: 'include',
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Ticket not found');
    }
    throw new Error('Failed to get ticket');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Update ticket
 */
export async function updateTicket(
  ticketId: number,
  updateData: UpdateTicketData
): Promise<SupportTicket> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_BY_ID(ticketId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updateData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update ticket');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Add response to ticket
 */
export async function addResponse(
  ticketId: number,
  message: string,
  options?: { isInternal?: boolean; files?: File[] }
): Promise<TicketResponse & { attachmentError?: string }> {
  const files = options?.files ?? [];
  let body: BodyInit;
  const headers: Record<string, string> = {};
  if (files.length > 0) {
    const form = new FormData();
    form.append('message', message);
    if (options?.isInternal !== undefined) form.append('isInternal', String(options.isInternal));
    files.forEach((file) => form.append('files', file));
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ message, ...(options?.isInternal !== undefined ? { isInternal: options.isInternal } : {}) });
  }

  const response = await fetch(API_ROUTES.SUPPORT.TICKET_RESPOND(ticketId), {
    method: 'POST',
    headers,
    credentials: 'include',
    body,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to add response');
  }

  const data = await response.json();
  return { ...data.data, attachmentError: data.attachmentError };
}

/**
 * A short-lived link to open one attachment (owner or staff only).
 */
export async function getAttachmentUrl(attachmentId: number): Promise<{ url: string; filename: string; mimeType: string }> {
  const response = await fetch(API_ROUTES.SUPPORT.ATTACHMENT(attachmentId), { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Could not open the file');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Close ticket
 */
export async function closeTicket(ticketId: number): Promise<SupportTicket> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_CLOSE(ticketId), {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to close ticket');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Reopen ticket
 */
export async function reopenTicket(ticketId: number): Promise<SupportTicket> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_REOPEN(ticketId), {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reopen ticket');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get ticket statistics
 */
export async function getTicketStats(): Promise<TicketStats> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_STATS, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get statistics');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get open ticket count
 */
export async function getOpenTicketCount(): Promise<number> {
  const response = await fetch(API_ROUTES.SUPPORT.TICKET_COUNT, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    return 0;
  }
  
  const data = await response.json();
  return data.data.count;
}

// ============================================
// AI API FUNCTIONS
// ============================================

/**
 * Auto-categorize ticket description
 */
export async function categorizeTicket(description: string): Promise<CategorizationResult> {
  const response = await fetch(API_ROUTES.HELP.AI_CATEGORIZE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ description }),
  });
  
  if (!response.ok) {
    // Return fallback on error
    return {
      category: 'OTHER',
      confidence: 0,
      suggestedPriority: 'MEDIUM',
      reasoning: 'Unable to categorize automatically',
      aiAvailable: false,
    };
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const response = await fetch(API_ROUTES.HELP.AI_SENTIMENT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  
  if (!response.ok) {
    return {
      sentiment: 'neutral',
      score: 0,
      escalationRecommended: false,
      reasoning: 'Unable to analyze sentiment',
      aiAvailable: false,
    };
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get AI response suggestion
 */
export async function suggestResponse(ticket: {
  subject: string;
  description: string;
  category: string;
}): Promise<ResponseSuggestion | null> {
  const response = await fetch(API_ROUTES.HELP.AI_SUGGEST_RESPONSE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(ticket),
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  return data.data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
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

/** What a member can raise with their association. */
export const MEMBER_CATEGORIES: TicketCategory[] = ['ACCESS', 'PAYMENTS', 'REPORTS', 'MEMBERS', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER'];

/** What an association admin can raise with SocietyLedger support (Tier 2). */
export const PLATFORM_CATEGORIES: TicketCategory[] = ['ACCESS', 'BILLING', 'DATA', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER'];

/**
 * Status wording. Staff handling someone else's ticket see "Waiting on User"; the person who opened it sees whose turn
 * it is from their side: "Waiting on you" / "Waiting on support" (the same words the mobile app uses).
 */
export function getStatusLabel(status: TicketStatus, asStaff: boolean): string {
  if (asStaff) return TICKET_STATUS_LABELS[status];
  if (status === 'WAITING_ON_USER') return 'Waiting on you';
  if (status === 'WAITING_ON_STAFF') return 'Waiting on support';
  return TICKET_STATUS_LABELS[status];
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_ON_USER: 'Waiting on User',
  WAITING_ON_STAFF: 'Waiting on Staff',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function getStatusColor(status: TicketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'blue';
    case 'IN_PROGRESS':
      return 'yellow';
    case 'WAITING_ON_USER':
      return 'orange';
    case 'WAITING_ON_STAFF':
      return 'purple';
    case 'RESOLVED':
      return 'green';
    case 'CLOSED':
      return 'gray';
    default:
      return 'gray';
  }
}

export function getPriorityColor(priority: TicketPriority): string {
  switch (priority) {
    case 'LOW':
      return 'gray';
    case 'MEDIUM':
      return 'blue';
    case 'HIGH':
      return 'orange';
    case 'URGENT':
      return 'red';
    default:
      return 'gray';
  }
}
