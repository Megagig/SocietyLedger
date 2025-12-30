// ============================================
// PHASE 21: SUPPORT TICKET SERVICE
// Ticket CRUD, responses, and status management
// ============================================

import { prisma } from '../../lib/prisma';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import {
  SupportTicket,
  TicketResponse,
  CreateTicketRequest,
  UpdateTicketRequest,
  AddResponseRequest,
  TicketListParams,
  TicketListResult,
  TicketStats,
  generateTicketNumber,
  isValidStatusTransition,
} from './support.types';

// ============================================
// SUPPORT SERVICE
// ============================================

export const supportService = {
  // ==========================================
  // TICKET CRUD
  // ==========================================

  /**
   * Create a new support ticket
   */
  async createTicket(
    associationId: number,
    userId: number,
    data: CreateTicketRequest
  ): Promise<SupportTicket> {
    // Get today's ticket count for sequence number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const ticketNumber = generateTicketNumber(new Date(), todayCount + 1);

    const ticket = await prisma.supportTicket.create({
      data: {
        associationId,
        userId,
        ticketNumber,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        // AI fields
        aiCategory: data.aiCategory,
        aiCategoryConfidence: data.aiCategoryConfidence,
        aiSentiment: data.aiSentiment,
        aiSentimentScore: data.aiSentimentScore,
        aiEscalationRecommended: data.aiSentiment === 'urgent' || (data.aiSentimentScore && data.aiSentimentScore < -0.5),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { responses: true, attachments: true },
        },
      },
    });

    return ticket as SupportTicket;
  },

  /**
   * List tickets with filtering and pagination
   */
  async listTickets(
    associationId: number,
    params: TicketListParams,
    options: { viewAll?: boolean; userId?: number } = {}
  ): Promise<TicketListResult> {
    const {
      status,
      category,
      priority,
      assignedToId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = params;

    const where: any = { associationId };

    // If not viewAll, only show user's own tickets
    if (!options.viewAll && options.userId) {
      where.userId = options.userId;
    }

    // Filter by specific user if provided in params
    if (params.userId) {
      where.userId = params.userId;
    }

    // Status filter
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Assigned to filter
    if (assignedToId !== undefined) {
      where.assignedToId = assignedToId;
    }

    // Search filter
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              member: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              email: true,
              member: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          _count: {
            select: { responses: true, attachments: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: tickets as SupportTicket[],
      total,
      hasMore: offset + tickets.length < total,
    };
  },

  /**
   * Get ticket by ID
   */
  async getTicketById(
    associationId: number,
    ticketId: number,
    options: { userId?: number; viewAll?: boolean } = {}
  ): Promise<SupportTicket | null> {
    const where: any = { id: ticketId, associationId };

    // If not viewAll, only allow viewing own tickets
    if (!options.viewAll && options.userId) {
      where.userId = options.userId;
    }

    const ticket = await prisma.supportTicket.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                member: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          where: { responseId: null }, // Only ticket-level attachments
        },
        _count: {
          select: { responses: true, attachments: true },
        },
      },
    });

    // Filter internal notes if not staff
    if (ticket && !options.viewAll) {
      ticket.responses = ticket.responses?.filter(r => !r.isInternal) || [];
    }

    return ticket as SupportTicket | null;
  },

  /**
   * Update ticket
   */
  async updateTicket(
    associationId: number,
    ticketId: number,
    data: UpdateTicketRequest,
    userId: number
  ): Promise<SupportTicket> {
    // Get current ticket
    const current = await prisma.supportTicket.findFirst({
      where: { id: ticketId, associationId },
    });

    if (!current) {
      throw new Error('Ticket not found');
    }

    // Validate status transition if status is being changed
    if (data.status && !isValidStatusTransition(current.status, data.status)) {
      throw new Error(`Invalid status transition from ${current.status} to ${data.status}`);
    }

    const updateData: any = { ...data };

    // Set timestamps based on status changes
    if (data.status === TicketStatus.RESOLVED && current.status !== TicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }
    if (data.status === TicketStatus.CLOSED && current.status !== TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }
    // Clear resolved/closed timestamps if reopening
    if (data.status === TicketStatus.OPEN && (current.status === TicketStatus.RESOLVED || current.status === TicketStatus.CLOSED)) {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: { responses: true, attachments: true },
        },
      },
    });

    return ticket as SupportTicket;
  },

  /**
   * Close ticket
   */
  async closeTicket(
    associationId: number,
    ticketId: number,
    userId: number
  ): Promise<SupportTicket> {
    return this.updateTicket(associationId, ticketId, {
      status: TicketStatus.CLOSED,
    }, userId);
  },

  /**
   * Reopen ticket
   */
  async reopenTicket(
    associationId: number,
    ticketId: number,
    userId: number
  ): Promise<SupportTicket> {
    return this.updateTicket(associationId, ticketId, {
      status: TicketStatus.OPEN,
    }, userId);
  },

  // ==========================================
  // RESPONSES
  // ==========================================

  /**
   * Add response to ticket
   */
  async addResponse(
    ticketId: number,
    userId: number,
    data: AddResponseRequest,
    isStaff: boolean = false
  ): Promise<TicketResponse> {
    // Get ticket to check association
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Create response
    const response = await prisma.ticketResponse.create({
      data: {
        ticketId,
        userId,
        message: data.message,
        isStaff,
        isInternal: data.isInternal || false,
        isAiGenerated: data.isAiGenerated || false,
        aiConfidence: data.aiConfidence,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Update ticket status and timestamps
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Set first response time if this is the first staff response
    if (isStaff && !ticket.firstResponseAt) {
      updateData.firstResponseAt = new Date();
    }

    // Update status based on who responded
    if (isStaff && !data.isInternal) {
      updateData.status = TicketStatus.WAITING_ON_USER;
    } else if (!isStaff) {
      updateData.status = TicketStatus.WAITING_ON_STAFF;
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    return response as TicketResponse;
  },

  /**
   * List responses for a ticket
   */
  async listResponses(
    ticketId: number,
    options: { includeInternal?: boolean } = {}
  ): Promise<TicketResponse[]> {
    const where: any = { ticketId };

    if (!options.includeInternal) {
      where.isInternal = false;
    }

    const responses = await prisma.ticketResponse.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            member: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return responses as TicketResponse[];
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get ticket statistics for association
   */
  async getTicketStats(associationId: number): Promise<TicketStats> {
    const [
      total,
      byStatus,
      byCategory,
      byPriority,
      avgTimes,
    ] = await Promise.all([
      // Total count
      prisma.supportTicket.count({ where: { associationId } }),
      
      // Count by status
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: { associationId },
        _count: { id: true },
      }),
      
      // Count by category
      prisma.supportTicket.groupBy({
        by: ['category'],
        where: { associationId },
        _count: { id: true },
      }),
      
      // Count by priority
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: { associationId },
        _count: { id: true },
      }),
      
      // Average response and resolution times
      prisma.$queryRaw<{ avgResponseHours: number | null; avgResolutionHours: number | null }[]>`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) as "avgResponseHours",
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as "avgResolutionHours"
        FROM support_tickets
        WHERE association_id = ${associationId}
          AND first_response_at IS NOT NULL
      `,
    ]);

    // Map status counts
    const statusCounts: Record<string, number> = {};
    byStatus.forEach(s => {
      statusCounts[s.status] = s._count.id;
    });

    return {
      total,
      open: statusCounts['OPEN'] || 0,
      inProgress: statusCounts['IN_PROGRESS'] || 0,
      waitingOnUser: statusCounts['WAITING_ON_USER'] || 0,
      waitingOnStaff: statusCounts['WAITING_ON_STAFF'] || 0,
      resolved: statusCounts['RESOLVED'] || 0,
      closed: statusCounts['CLOSED'] || 0,
      avgResponseTimeHours: avgTimes[0]?.avgResponseHours || null,
      avgResolutionTimeHours: avgTimes[0]?.avgResolutionHours || null,
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.id,
      })),
      byPriority: byPriority.map(p => ({
        priority: p.priority,
        count: p._count.id,
      })),
    };
  },

  /**
   * Get open ticket count for user
   */
  async getOpenTicketCount(
    associationId: number,
    userId?: number
  ): Promise<number> {
    const where: any = {
      associationId,
      status: {
        in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_ON_USER, TicketStatus.WAITING_ON_STAFF],
      },
    };

    if (userId) {
      where.userId = userId;
    }

    return prisma.supportTicket.count({ where });
  },
};

export default supportService;
