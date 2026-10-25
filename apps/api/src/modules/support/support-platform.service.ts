// ============================================
// SUPPORT — PLATFORM SIDE (Tier 2)
// SocietyLedger's own support staff answering association admins' tickets. Everything here is hard-wired to
// audience = PLATFORM: a member's Tier 1 ticket is between them and their association and is never readable from here.
// ============================================

import { TicketAudience, TicketStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { escapeHtml } from '../../lib/escape-html';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { supportService, toPublicAttachment } from './support.service';
import { isValidStatusTransition } from './support.types';
import type { AddResponseRequest } from './support.types';

const PERSON = { select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } } } as const;
const ASSOCIATION = { select: { id: true, name: true, subdomain: true } } as const;

export interface PlatformTicketListParams {
  status?: TicketStatus | TicketStatus[];
  category?: string;
  priority?: string;
  associationId?: number;
  assignedToId?: number;
  unassigned?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

function excerptOf(message: string): string {
  return message.length > 280 ? `${message.slice(0, 277)}...` : message;
}

export const platformSupportService = {
  /** Tier 2 tickets from every association, newest activity first by default. */
  async listTickets(params: PlatformTicketListParams = {}) {
    const { status, category, priority, associationId, assignedToId, unassigned, search, sortBy = 'updatedAt', sortOrder = 'desc', limit = 20, offset = 0 } = params;

    const where: any = { audience: TicketAudience.PLATFORM };
    if (status) where.status = Array.isArray(status) ? { in: status } : status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (associationId) where.associationId = associationId;
    if (assignedToId) where.assignedToId = assignedToId;
    else if (unassigned) where.assignedToId = null;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { association: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: { association: ASSOCIATION, user: PERSON, assignedTo: PERSON, _count: { select: { responses: true, attachments: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { tickets, total, hasMore: offset + tickets.length < total };
  },

  /** One Tier 2 ticket with every reply, internal notes included. Null for anything that is not a platform ticket. */
  async getTicket(ticketId: number) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, audience: TicketAudience.PLATFORM },
      include: {
        association: ASSOCIATION,
        user: PERSON,
        assignedTo: PERSON,
        responses: { include: { user: PERSON, attachments: true }, orderBy: { createdAt: 'asc' } },
        attachments: { where: { responseId: null } },
        _count: { select: { responses: true, attachments: true } },
      },
    });
    if (!ticket) return null;

    const { escalatedFromId, ...rest } = ticket;
    return {
      ...rest,
      // Whether it began as an escalation — never which member ticket, so nothing of the member's is reachable.
      isEscalation: escalatedFromId !== null,
      attachments: ticket.attachments.map(toPublicAttachment),
      responses: ticket.responses.map((r) => ({ ...r, attachments: r.attachments.map(toPublicAttachment) })),
    };
  },

  async getStats() {
    const where = { audience: TicketAudience.PLATFORM };
    const [total, byStatus, unassigned] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.supportTicket.count({ where: { ...where, assignedToId: null, status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Partial<Record<TicketStatus, number>>;
    return {
      total,
      open: (counts.OPEN ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.WAITING_ON_USER ?? 0) + (counts.WAITING_ON_STAFF ?? 0),
      waitingOnStaff: counts.WAITING_ON_STAFF ?? 0,
      waitingOnUser: counts.WAITING_ON_USER ?? 0,
      resolved: counts.RESOLVED ?? 0,
      closed: counts.CLOSED ?? 0,
      unassigned,
    };
  },

  /** SocietyLedger's support staff, for the assign dropdown. */
  async listStaff() {
    const staff = await supportService.getPlatformStaff();
    const users = await prisma.user.findMany({
      where: { id: { in: staff.map((s) => s.id) } },
      select: { id: true, email: true, member: { select: { firstName: true, lastName: true } }, platformRole: true },
      orderBy: { email: 'asc' },
    });
    return users;
  },

  /** Reply as SocietyLedger support (or leave an internal note). A visible reply tells the admin who opened the ticket. */
  async respond(ticketId: number, staffUserId: number, data: AddResponseRequest) {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, audience: TicketAudience.PLATFORM }, select: { id: true, associationId: true } });
    if (!ticket) throw new Error('Ticket not found');

    const response = await supportService.addResponse(ticketId, staffUserId, data, true);
    return { response, associationId: ticket.associationId };
  },

  /** Assign, change status or change priority. Status moves follow the same rules as everywhere else. */
  async updateTicket(ticketId: number, staffUserId: number, data: { status?: TicketStatus; priority?: any; assignedToId?: number | null }) {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, audience: TicketAudience.PLATFORM }, select: { id: true, associationId: true, status: true } });
    if (!ticket) throw new Error('Ticket not found');

    if (data.status && !isValidStatusTransition(ticket.status, data.status)) {
      throw new Error(`Invalid status transition from ${ticket.status} to ${data.status}`);
    }
    if (data.assignedToId) {
      const staffIds = (await supportService.getPlatformStaff()).map((s) => s.id);
      if (!staffIds.includes(data.assignedToId)) throw new Error('Tickets can only be assigned to SocietyLedger support staff');
    }

    const updated = await supportService.updateTicket(ticket.associationId, ticketId, data, staffUserId);
    return { updated, associationId: ticket.associationId, statusChanged: !!data.status && data.status !== ticket.status };
  },

  /** An attachment on a Tier 2 ticket, or null. Nothing on a Tier 1 ticket is ever returned. */
  async getAttachmentForAccess(attachmentId: number) {
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { audience: true } } },
    });
    if (!attachment || attachment.ticket.audience !== TicketAudience.PLATFORM) return null;
    return attachment;
  },

  /** Tell the admin who opened the ticket that SocietyLedger support replied (in-app, push, email). Best-effort. */
  async notifyOpenerOfReply(ticketId: number, message: string) {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, userId: true, associationId: true, ticketNumber: true, subject: true, association: { select: { name: true } } },
      });
      if (!ticket) return;
      const excerpt = excerptOf(message);

      await dispatchNotification({
        associationId: ticket.associationId,
        userId: ticket.userId,
        title: 'SocietyLedger support replied',
        message: `${ticket.ticketNumber}: ${excerpt}`,
        kind: 'system',
        entityId: ticket.id,
        pushType: 'support.ticket_reply',
        sendEmail: true,
        emailSubject: `SocietyLedger support replied to ${ticket.ticketNumber}`,
        emailTemplate: 'support-ticket-reply',
        emailData: {
          fromStaff: true,
          staffLabel: 'SocietyLedger support',
          associationName: escapeHtml(ticket.association.name),
          ticketNumber: escapeHtml(ticket.ticketNumber),
          subject: escapeHtml(ticket.subject),
          excerpt: escapeHtml(excerpt),
          path: `/dashboard/help/tickets/${ticket.id}`,
        },
      });
    } catch (error) {
      console.error('Platform reply notification failed (non-critical):', error);
    }
  },

  /** Tell the opener their Tier 2 ticket was resolved or closed. Best-effort. */
  async notifyOpenerOfStatus(ticketId: number, status: TicketStatus) {
    try {
      if (status !== TicketStatus.RESOLVED && status !== TicketStatus.CLOSED) return;
      const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, userId: true, associationId: true, ticketNumber: true } });
      if (!ticket) return;

      await dispatchNotification({
        associationId: ticket.associationId,
        userId: ticket.userId,
        title: status === TicketStatus.RESOLVED ? 'Your ticket was resolved' : 'Your ticket was closed',
        message: `SocietyLedger support marked ${ticket.ticketNumber} as ${status === TicketStatus.RESOLVED ? 'resolved' : 'closed'}. You can reopen it if you still need help.`,
        kind: 'system',
        entityId: ticket.id,
        pushType: 'support.ticket_reply',
      });
    } catch (error) {
      console.error('Platform status notification failed (non-critical):', error);
    }
  },
};
