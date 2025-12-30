// ============================================
// PHASE 21: SUPPORT TICKET TYPES
// ============================================

import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

// ============================================
// TICKET TYPES
// ============================================

export interface SupportTicket {
  id: number;
  associationId: number;
  userId: number;
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
  resolvedAt: Date | null;
  closedAt: Date | null;
  firstResponseAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: number;
    email: string;
    member?: {
      firstName: string;
      lastName: string;
    };
  };
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  responseId: number | null;
  userId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  createdAt: Date;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  // AI-suggested values (optional, can be overridden)
  aiCategory?: string;
  aiCategoryConfidence?: number;
  aiSentiment?: string;
  aiSentimentScore?: number;
}

export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedToId?: number | null;
}

export interface AddResponseRequest {
  message: string;
  isInternal?: boolean;
  isAiGenerated?: boolean;
  aiConfidence?: number;
}

export interface TicketListParams {
  status?: TicketStatus | TicketStatus[];
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedToId?: number;
  userId?: number;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================
// RESPONSE TYPES
// ============================================

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

// ============================================
// TICKET NUMBER FORMAT
// ============================================

// Format: TKT-YYYYMMDD-XXXX (e.g., TKT-20251230-0001)
export function generateTicketNumber(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `TKT-${year}${month}${day}-${seq}`;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_USER', 'WAITING_ON_STAFF', 'RESOLVED', 'CLOSED'],
  WAITING_ON_USER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_STAFF: ['IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'], // Can reopen or close
  CLOSED: ['OPEN'], // Can only reopen
};

export function isValidStatusTransition(
  currentStatus: TicketStatus,
  newStatus: TicketStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ============================================
// ALLOWED FILE TYPES
// ============================================

export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB

export function isAllowedAttachmentType(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_TYPES.includes(mimeType);
}
