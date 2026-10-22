// ============================================
// PHASE 21: SUPPORT TICKET SERVICE
// Ticket CRUD, responses, and status management
// ============================================

import { prisma } from '../../lib/prisma';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { escapeHtml } from '../../lib/escape-html';
import { TicketAudience, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { sendEmail } from '../../lib/email';
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

/** What clients may see of an attachment — never the storage key. */
export function toPublicAttachment(a: any) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    responseId: a.responseId,
    originalName: a.originalName,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    createdAt: a.createdAt,
  };
}

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
    data: CreateTicketRequest,
    options: { audience?: TicketAudience; escalatedFromId?: number } = {}
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
        audience: options.audience ?? TicketAudience.ASSOCIATION,
        escalatedFromId: options.escalatedFromId,
        // AI fields
        aiCategory: data.aiCategory,
        aiCategoryConfidence: data.aiCategoryConfidence,
        aiSentiment: data.aiSentiment,
        aiSentimentScore: data.aiSentimentScore,
        aiEscalationRecommended: data.aiSentiment === 'urgent' || (data.aiSentimentScore !== undefined && data.aiSentimentScore < -0.5),
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

    // Tier 1 (default) or Tier 2. A Tier 2 ticket is between one association admin and SocietyLedger, so even other
    // staff in the association only ever see their own.
    where.audience = params.audience ?? TicketAudience.ASSOCIATION;

    // Not staff: only their own tickets, always. (-1 matches nothing, so a missing user id can never widen the list.)
    if (!options.viewAll || where.audience === TicketAudience.PLATFORM) {
      where.userId = options.userId ?? -1;
    } else if (params.userId) {
      // Only staff may filter by another user — for anyone else this parameter would override the line above.
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
    // A Tier 2 ticket is readable here only by the admin who opened it, whatever their permissions.
    const where: any = {
      id: ticketId,
      associationId,
      OR: [{ audience: TicketAudience.ASSOCIATION }, { userId: options.userId ?? -1 }],
    };

    // If not staff, only allow viewing own tickets
    if (!options.viewAll) {
      where.userId = options.userId ?? -1;
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

    if (ticket) {
      const t: any = ticket;
      t.attachments = (t.attachments ?? []).map(toPublicAttachment);
      t.responses = (t.responses ?? []).map((r: any) => ({ ...r, attachments: (r.attachments ?? []).map(toPublicAttachment) }));
    }

    return ticket as SupportTicket | null;
  },

  /**
   * Everyone in the association who can work tickets (support.view_all or support.manage) — the people a new ticket
   * or a member's reply should reach.
   */
  async getStaffUserIds(associationId: number): Promise<number[]> {
    const rows = await prisma.userRole.findMany({
      where: {
        associationId,
        isActive: true,
        user: { isActive: true },
        role: { isActive: true, permissions: { some: { permission: { key: { in: ['support.view_all', 'support.manage'] } } } } },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  },

  /** A member opened a ticket: tell the association's support staff (in-app, push, email). Best-effort, never throws. */
  async notifyStaffOfNewTicket(associationId: number, ticket: { id: number; userId: number; ticketNumber: string; subject: string; category: string; priority: string }) {
    try {
      const [staffIds, opener, association] = await Promise.all([
        this.getStaffUserIds(associationId),
        prisma.user.findUnique({ where: { id: ticket.userId }, select: { email: true, member: { select: { firstName: true, lastName: true } } } }),
        prisma.association.findUnique({ where: { id: associationId }, select: { name: true } }),
      ]);
      const openerName = opener?.member ? `${opener.member.firstName} ${opener.member.lastName}` : opener?.email ?? 'A member';

      for (const userId of staffIds.filter((id) => id !== ticket.userId)) {
        try {
          await dispatchNotification({
            associationId,
            userId,
            title: 'New support ticket',
            message: `${openerName} opened ${ticket.ticketNumber}: ${ticket.subject}`,
            kind: 'approval',
            entityId: ticket.id,
            pushType: 'support.ticket_created',
            sendEmail: true,
            emailSubject: `New support ticket ${ticket.ticketNumber}`,
            emailTemplate: 'support-ticket-new',
            emailData: {
              openerName: escapeHtml(openerName),
              associationName: escapeHtml(association?.name ?? 'your association'),
              ticketNumber: escapeHtml(ticket.ticketNumber),
              subject: escapeHtml(ticket.subject),
              category: escapeHtml(ticket.category.replace(/_/g, ' ').toLowerCase()),
              priority: escapeHtml(ticket.priority.toLowerCase()),
            },
          });
        } catch (error) {
          console.error(`Support ticket notification failed for user ${userId} (non-critical):`, error);
        }
      }
    } catch (error) {
      console.error('Support ticket notification failed (non-critical):', error);
    }
  },

  /**
   * A reply was added. A staff reply the member can see tells the member (the push opens the ticket on mobile); a
   * member's reply tells the assigned staff member, or all staff if nobody is assigned. Internal notes tell no one.
   */
  async notifyOfReply(associationId: number, ticketId: number, reply: { userId: number; message: string; isStaff: boolean; isInternal: boolean }) {
    try {
      if (reply.isInternal) return;
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, userId: true, audience: true, assignedToId: true, ticketNumber: true, subject: true, association: { select: { name: true } } },
      });
      if (!ticket) return;

      // Tier 2: the association admin is the customer, so their reply goes to SocietyLedger's support staff. (Platform
      // staff replies are announced by the platform service.)
      if (ticket.audience === TicketAudience.PLATFORM) {
        if (reply.isStaff) return;
        const excerpt = reply.message.length > 280 ? `${reply.message.slice(0, 277)}...` : reply.message;
        await this.notifyPlatformStaff({
          title: 'New reply on a platform ticket',
          message: `${ticket.association.name} · ${ticket.ticketNumber}: ${excerpt}`,
          subject: `Reply on platform ticket ${ticket.ticketNumber}`,
          entityId: ticket.id,
          template: 'support-ticket-reply',
          data: {
            fromStaff: false,
            customerLabel: `An admin at ${escapeHtml(ticket.association.name)}`,
            associationName: escapeHtml(ticket.association.name),
            ticketNumber: escapeHtml(ticket.ticketNumber),
            subject: escapeHtml(ticket.subject),
            excerpt: escapeHtml(excerpt),
            url: `${process.env.ADMIN_URL || 'https://admin.societyledger.com.ng'}/support/tickets/${ticket.id}`,
          },
        });
        return;
      }

      const excerpt = reply.message.length > 280 ? `${reply.message.slice(0, 277)}...` : reply.message;
      const recipients = reply.isStaff
        ? [ticket.userId]
        : (ticket.assignedToId ? [ticket.assignedToId] : await this.getStaffUserIds(associationId)).filter((id) => id !== reply.userId);

      for (const userId of recipients) {
        try {
          await dispatchNotification({
            associationId,
            userId,
            title: reply.isStaff ? 'New reply on your support ticket' : 'New reply from a member',
            message: `${ticket.ticketNumber}: ${excerpt}`,
            kind: 'system',
            entityId: ticket.id,
            pushType: reply.isStaff ? 'support.ticket_reply' : 'support.ticket_member_reply',
            sendEmail: true,
            emailSubject: reply.isStaff ? `Reply on your support ticket ${ticket.ticketNumber}` : `Member reply on ${ticket.ticketNumber}`,
            emailTemplate: 'support-ticket-reply',
            emailData: {
              fromStaff: reply.isStaff,
              associationName: escapeHtml(ticket.association.name),
              ticketNumber: escapeHtml(ticket.ticketNumber),
              subject: escapeHtml(ticket.subject),
              excerpt: escapeHtml(excerpt),
              path: `/dashboard/help/tickets/${ticket.id}`,
            },
          });
        } catch (error) {
          console.error(`Support reply notification failed for user ${userId} (non-critical):`, error);
        }
      }
    } catch (error) {
      console.error('Support reply notification failed (non-critical):', error);
    }
  },

  /**
   * An officer escalates a member's ticket to SocietyLedger. This opens a *new* Tier 2 ticket in the officer's own
   * words — nothing of the member's ticket is copied — links it back, and leaves a staff-only note on the original so
   * the next officer knows. The member is not told.
   */
  async escalateTicket(
    associationId: number,
    sourceTicketId: number,
    officerUserId: number,
    data: { subject: string; summary: string; category: TicketCategory; priority?: TicketPriority }
  ): Promise<SupportTicket> {
    const ticket = await this.createTicket(
      associationId,
      officerUserId,
      { subject: data.subject, description: data.summary, category: data.category, priority: data.priority },
      { audience: TicketAudience.PLATFORM, escalatedFromId: sourceTicketId }
    );

    try {
      await prisma.ticketResponse.create({
        data: {
          ticketId: sourceTicketId,
          userId: officerUserId,
          message: `Escalated to SocietyLedger support as ${ticket.ticketNumber}.`,
          isStaff: true,
          isInternal: true,
        },
      });
    } catch (error) {
      console.error('Could not leave the escalation note (non-critical):', error);
    }

    return ticket;
  },

  /** SocietyLedger's own support staff (SUPER_ADMIN and SUPPORT_AGENT accounts). */
  async getPlatformStaff() {
    return prisma.user.findMany({
      where: { isActive: true, platformRole: { in: ['SUPER_ADMIN', 'SUPPORT_AGENT'] } },
      select: { id: true, email: true, associationId: true },
    });
  },

  /**
   * Tells SocietyLedger's support staff about a Tier 2 ticket or reply: in-app and push when the account belongs to an
   * association (platform staff accounts do), and always by email. Best-effort, never throws.
   */
  async notifyPlatformStaff(payload: { title: string; message: string; subject: string; entityId: number; template: string; data: Record<string, unknown> }) {
    try {
      for (const person of await this.getPlatformStaff()) {
        try {
          if (person.associationId) {
            await dispatchNotification({
              associationId: person.associationId,
              userId: person.id,
              title: payload.title,
              message: payload.message,
              kind: 'approval',
              entityId: payload.entityId,
              pushType: 'support.platform_ticket',
              sendEmail: true,
              emailSubject: payload.subject,
              emailTemplate: payload.template,
              emailData: payload.data,
            });
          } else if (person.email) {
            await sendEmail({ to: person.email, subject: payload.subject, template: payload.template, data: payload.data });
          }
        } catch (error) {
          console.error(`Platform support notification failed for user ${person.id} (non-critical):`, error);
        }
      }
    } catch (error) {
      console.error('Platform support notification failed (non-critical):', error);
    }
  },

  /** An association admin opened (or escalated into) a Tier 2 ticket: tell SocietyLedger's support staff. */
  async notifyPlatformOfNewTicket(ticket: { id: number; userId: number; associationId: number; ticketNumber: string; subject: string; category: string; priority: string; escalatedFromId?: number | null }) {
    try {
      const [opener, association] = await Promise.all([
        prisma.user.findUnique({ where: { id: ticket.userId }, select: { email: true, member: { select: { firstName: true, lastName: true } } } }),
        prisma.association.findUnique({ where: { id: ticket.associationId }, select: { name: true } }),
      ]);
      const openerName = opener?.member ? `${opener.member.firstName} ${opener.member.lastName}` : opener?.email ?? 'An admin';
      const associationName = association?.name ?? 'an association';

      await this.notifyPlatformStaff({
        title: 'New platform ticket',
        message: `${associationName}: ${ticket.subject} (${ticket.ticketNumber})`,
        subject: `New platform ticket ${ticket.ticketNumber} from ${associationName}`,
        entityId: ticket.id,
        template: 'support-ticket-new',
        data: {
          openerName: escapeHtml(openerName),
          associationName: escapeHtml(associationName),
          ticketNumber: escapeHtml(ticket.ticketNumber),
          subject: escapeHtml(ticket.subject),
          category: escapeHtml(ticket.category.replace(/_/g, ' ').toLowerCase()),
          priority: escapeHtml(ticket.priority.toLowerCase()),
          platform: true,
          escalated: !!ticket.escalatedFromId,
          url: `${process.env.ADMIN_URL || 'https://admin.societyledger.com.ng'}/support/tickets/${ticket.id}`,
        },
      });
    } catch (error) {
      console.error('Platform ticket notification failed (non-critical):', error);
    }
  },

  /**
   * Records uploaded files against a ticket (responseId null) or one of its replies.
   */
  async addAttachments(
    ticketId: number,
    userId: number,
    responseId: number | null,
    files: { key: string; originalName: string; mimeType: string; size: number }[]
  ) {
    const created = [];
    for (const file of files) {
      const row = await prisma.ticketAttachment.create({
        data: {
          ticketId,
          responseId,
          userId,
          filename: file.key.split('/').pop() ?? file.key,
          originalName: file.originalName,
          mimeType: file.mimeType,
          fileSize: file.size,
          filePath: file.key,
        },
      });
      created.push(toPublicAttachment(row));
    }
    return created;
  },

  /**
   * An attachment the caller may open, or null. Staff (viewAll) can open any in their association; anyone else only
   * files on their own ticket, and never files on a staff-only internal note.
   */
  async getAttachmentForAccess(associationId: number, attachmentId: number, options: { userId?: number; viewAll?: boolean } = {}) {
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: { select: { associationId: true, userId: true, audience: true } },
        response: { select: { isInternal: true } },
      },
    });
    if (!attachment || attachment.ticket.associationId !== associationId) return null;
    if (attachment.ticket.audience === TicketAudience.PLATFORM && attachment.ticket.userId !== options.userId) return null;
    if (!options.viewAll) {
      if (attachment.ticket.userId !== options.userId) return null;
      if (attachment.response?.isInternal) return null;
    }
    return attachment;
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
      prisma.supportTicket.count({ where: { associationId, audience: 'ASSOCIATION' } }),
      
      // Count by status
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: { associationId, audience: 'ASSOCIATION' },
        _count: { id: true },
      }),
      
      // Count by category
      prisma.supportTicket.groupBy({
        by: ['category'],
        where: { associationId, audience: 'ASSOCIATION' },
        _count: { id: true },
      }),
      
      // Count by priority
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: { associationId, audience: 'ASSOCIATION' },
        _count: { id: true },
      }),
      
      // Average response and resolution times
      prisma.$queryRaw<{ avgResponseHours: number | null; avgResolutionHours: number | null }[]>`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) as "avgResponseHours",
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as "avgResolutionHours"
        FROM support_tickets
        WHERE association_id = ${associationId} AND audience = 'ASSOCIATION'
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
      audience: TicketAudience.ASSOCIATION,
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
