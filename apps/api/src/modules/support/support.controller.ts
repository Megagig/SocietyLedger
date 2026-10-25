// ============================================
// PHASE 21: SUPPORT CONTROLLER
// Ticket management endpoints
// ============================================

import { Request, Response } from 'express';
import { supportService } from './support.service';
import {
  createTicketSchema,
  createPlatformTicketSchema,
  escalateTicketSchema,
  updateTicketSchema,
  addResponseSchema,
  listTicketsQuerySchema,
} from './support.validation';
import { prisma } from '../../lib/prisma';
import { getPresignedUrl } from '../../lib/storage';
import { saveAttachments } from './support-attachments';

// ============================================
// SUPPORT CONTROLLER
// ============================================

/** Staff can see every ticket in the association; everyone else only their own. */
function canViewAllTickets(req: Request): boolean {
  const permissions = (req as any).permissions as Set<string> | undefined;
  return !!(permissions?.has('support.view_all') || permissions?.has('support.manage'));
}

export const supportController = {
  // ==========================================
  // TICKETS
  // ==========================================

  /**
   * Create a new ticket
   * POST /api/support/tickets
   */
  async createTicket(req: Request, res: Response) {
    try {
      const validation = createTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const ticket = await supportService.createTicket(
        associationId,
        userId,
        validation.data
      );

      const { attachments, attachmentError } = await saveAttachments(
        associationId,
        ticket.id,
        userId,
        null,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );

      // Tell the association's support staff. Not awaited: the member shouldn't wait on the email provider.
      void supportService.notifyStaffOfNewTicket(associationId, ticket);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_created',
          tableName: 'support_tickets',
          recordId: ticket.id,
          newValues: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority,
          },
        },
      });

      res.status(201).json({
        success: true,
        data: { ...ticket, attachments },
        ...(attachmentError ? { attachmentError } : {}),
      });
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket',
        message: error.message,
      });
    }
  },

  /**
   * List tickets
   * GET /api/support/tickets
   */
  async listTickets(req: Request, res: Response) {
    try {
      const validation = listTicketsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Check if user can view all tickets
      const permissions = (req as any).permissions as Set<string> | undefined;
      const canViewAll = permissions?.has('support.view_all') || permissions?.has('support.manage');

      const result = await supportService.listTickets(
        associationId,
        validation.data,
        { viewAll: canViewAll, userId }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error listing tickets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list tickets',
        message: error.message,
      });
    }
  },

  /**
   * Get ticket by ID
   * GET /api/support/tickets/:id
   */
  async getTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket ID',
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const permissions = (req as any).permissions as Set<string> | undefined;
      const canViewAll = permissions?.has('support.view_all') || permissions?.has('support.manage');

      const ticket = await supportService.getTicketById(
        associationId,
        ticketId,
        { viewAll: canViewAll, userId }
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('Error getting ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ticket',
        message: error.message,
      });
    }
  },

  /**
   * Update ticket
   * PATCH /api/support/tickets/:id
   */
  async updateTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket ID',
        });
      }

      const validation = updateTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const ticket = await supportService.updateTicket(
        associationId,
        ticketId,
        validation.data,
        userId
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_updated',
          tableName: 'support_tickets',
          recordId: ticket.id,
          newValues: validation.data,
        },
      });

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update ticket',
        message: error.message,
      });
    }
  },

  /**
   * Add response to ticket
   * POST /api/support/tickets/:id/respond
   */
  async addResponse(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket ID',
        });
      }

      const validation = addResponseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Check if user is staff (can respond to any ticket)
      const permissions = (req as any).permissions as Set<string> | undefined;
      const isStaff = permissions?.has('support.respond') || permissions?.has('support.manage');

      // Verify user can access this ticket
      const ticket = await supportService.getTicketById(
        associationId,
        ticketId,
        { viewAll: isStaff, userId }
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      // On a Tier 2 ticket the association admin is the customer, not staff — only SocietyLedger's team answers as staff
      // (through the admin console), so even an admin holding support.respond replies here as the customer.
      const staffReply = ticket.audience !== 'PLATFORM' && !!isStaff;

      // Only staff can add internal notes
      if (validation.data.isInternal && !staffReply) {
        return res.status(403).json({
          success: false,
          error: 'Only staff can add internal notes',
        });
      }

      // Only staff may mark a reply as AI-generated.
      const responseData = staffReply ? validation.data : { ...validation.data, isAiGenerated: false, aiConfidence: undefined };

      const response = await supportService.addResponse(
        ticketId,
        userId,
        responseData,
        staffReply
      );

      const { attachments, attachmentError } = await saveAttachments(
        associationId,
        ticketId,
        userId,
        response.id,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );

      // Tell the other side of the conversation (internal notes tell no one). Not awaited.
      void supportService.notifyOfReply(associationId, ticketId, {
        userId,
        message: validation.data.message,
        isStaff: staffReply,
        isInternal: !!validation.data.isInternal,
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_responded',
          tableName: 'ticket_responses',
          recordId: response.id,
          newValues: {
            ticketId,
            isStaff: staffReply,
            isInternal: validation.data.isInternal,
          },
        },
      });

      res.status(201).json({
        success: true,
        data: { ...response, attachments },
        ...(attachmentError ? { attachmentError } : {}),
      });
    } catch (error: any) {
      console.error('Error adding response:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add response',
        message: error.message,
      });
    }
  },

  /**
   * Close ticket
   * POST /api/support/tickets/:id/close
   */
  async closeTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket ID',
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // The route is open to any ticket creator, so check this is their own ticket (or they are staff).
      const existing = await supportService.getTicketById(associationId, ticketId, { viewAll: canViewAllTickets(req), userId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      const ticket = await supportService.closeTicket(
        associationId,
        ticketId,
        userId
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_closed',
          tableName: 'support_tickets',
          recordId: ticket.id,
        },
      });

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('Error closing ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to close ticket',
        message: error.message,
      });
    }
  },

  /**
   * Reopen ticket
   * POST /api/support/tickets/:id/reopen
   */
  async reopenTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket ID',
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // The route is open to any ticket creator, so check this is their own ticket (or they are staff).
      const existing = await supportService.getTicketById(associationId, ticketId, { viewAll: canViewAllTickets(req), userId });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      const ticket = await supportService.reopenTicket(
        associationId,
        ticketId,
        userId
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_reopened',
          tableName: 'support_tickets',
          recordId: ticket.id,
        },
      });

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('Error reopening ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reopen ticket',
        message: error.message,
      });
    }
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get ticket statistics
   * GET /api/support/tickets/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const stats = await supportService.getTicketStats(associationId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        message: error.message,
      });
    }
  },

  /**
   * Get open ticket count
   * GET /api/support/tickets/count
   */
  /**
   * An association admin opens a ticket to SocietyLedger support (Tier 2) — billing, bugs, modules, data, features.
   * POST /api/support/platform-tickets   (multipart or JSON, same attachments as a normal ticket)
   */
  async createPlatformTicket(req: Request, res: Response) {
    try {
      const validation = createPlatformTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const ticket = await supportService.createTicket(associationId, userId, validation.data, { audience: 'PLATFORM' });

      const { attachments, attachmentError } = await saveAttachments(
        associationId,
        ticket.id,
        userId,
        null,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_platform_ticket_created',
          tableName: 'support_tickets',
          recordId: ticket.id,
          newValues: { ticketNumber: ticket.ticketNumber, subject: ticket.subject, category: ticket.category },
        },
      });

      // Tell SocietyLedger's support staff. Not awaited: the admin shouldn't wait on the email provider.
      void supportService.notifyPlatformOfNewTicket(ticket);

      res.status(201).json({
        success: true,
        data: { ...ticket, attachments },
        ...(attachmentError ? { attachmentError } : {}),
      });
    } catch (error: any) {
      console.error('Error creating platform ticket:', error);
      res.status(500).json({ success: false, error: 'Failed to create ticket', message: error.message });
    }
  },

  /**
   * An officer escalates a member's ticket to SocietyLedger. Opens a new Tier 2 ticket in the officer's own words and
   * links it back; the member's ticket and its content are never shared.
   * POST /api/support/tickets/:id/escalate
   */
  async escalateTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) {
        return res.status(400).json({ success: false, error: 'Invalid ticket ID' });
      }

      const validation = escalateTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Only the association's support staff handle member tickets, so only they can escalate one.
      if (!canViewAllTickets(req)) {
        return res.status(403).json({ success: false, error: 'Only support staff can escalate a ticket' });
      }

      const source = await supportService.getTicketById(associationId, ticketId, { viewAll: true, userId });
      if (!source || source.audience === 'PLATFORM') {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      const ticket = await supportService.escalateTicket(associationId, ticketId, userId, validation.data);

      const { attachments, attachmentError } = await saveAttachments(
        associationId,
        ticket.id,
        userId,
        null,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_ticket_escalated',
          tableName: 'support_tickets',
          recordId: ticketId,
          newValues: { platformTicketId: ticket.id, ticketNumber: ticket.ticketNumber },
        },
      });

      void supportService.notifyPlatformOfNewTicket({ ...ticket, escalatedFromId: ticketId });

      res.status(201).json({
        success: true,
        data: { ...ticket, attachments },
        ...(attachmentError ? { attachmentError } : {}),
      });
    } catch (error: any) {
      console.error('Error escalating ticket:', error);
      res.status(500).json({ success: false, error: 'Failed to escalate ticket', message: error.message });
    }
  },

  /**
   * A short-lived link to open one attachment. Owner or staff only; never a staff-only internal note's file for a member.
   * GET /api/support/attachments/:id
   */
  async getAttachment(req: Request, res: Response) {
    try {
      const attachmentId = parseInt(req.params.id);
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (isNaN(attachmentId) || !associationId || !userId) {
        return res.status(400).json({ success: false, error: 'Invalid request' });
      }

      const attachment = await supportService.getAttachmentForAccess(associationId, attachmentId, {
        viewAll: canViewAllTickets(req),
        userId,
      });
      if (!attachment) {
        return res.status(404).json({ success: false, error: 'Attachment not found' });
      }

      const url = await getPresignedUrl(attachment.filePath, undefined, req.hostname);
      res.json({ success: true, data: { url, filename: attachment.originalName, mimeType: attachment.mimeType } });
    } catch (error: any) {
      console.error('Error getting attachment:', error);
      res.status(500).json({ success: false, error: 'Failed to get attachment', message: error.message });
    }
  },

  async getOpenCount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const permissions = (req as any).permissions as Set<string> | undefined;
      const canViewAll = permissions?.has('support.view_all') || permissions?.has('support.manage');

      const count = await supportService.getOpenTicketCount(
        associationId,
        canViewAll ? undefined : userId
      );

      res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error getting count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get count',
        message: error.message,
      });
    }
  },
};

export default supportController;
