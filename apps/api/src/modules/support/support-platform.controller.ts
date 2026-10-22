// ============================================
// SUPPORT — PLATFORM CONTROLLER (Tier 2)
// /api/admin/support/* — SUPER_ADMIN and SUPPORT_AGENT only (enforced in the routes)
// ============================================

import { Request, Response } from 'express';
import { getPresignedUrl } from '../../lib/storage';
import { prisma } from '../../lib/prisma';
import { saveAttachments } from './support-attachments';
import { platformSupportService } from './support-platform.service';
import { addResponseSchema, platformListQuerySchema, platformUpdateTicketSchema } from './support.validation';

function fail(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ success: false, error, message: error, ...extra });
}

export const platformSupportController = {
  /** GET /api/admin/support/tickets */
  async listTickets(req: Request, res: Response) {
    try {
      const validation = platformListQuerySchema.safeParse(req.query);
      if (!validation.success) return fail(res, 400, 'Validation failed', { details: validation.error.errors });

      res.json({ success: true, data: await platformSupportService.listTickets(validation.data) });
    } catch (error: any) {
      console.error('Error listing platform tickets:', error);
      fail(res, 500, 'Failed to list tickets');
    }
  },

  /** GET /api/admin/support/stats */
  async getStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await platformSupportService.getStats() });
    } catch (error: any) {
      console.error('Error getting platform ticket stats:', error);
      fail(res, 500, 'Failed to get stats');
    }
  },

  /** GET /api/admin/support/staff — the assign list, plus who is asking (support agents can't read /admin/me) */
  async listStaff(req: Request, res: Response) {
    try {
      res.json({ success: true, data: { staff: await platformSupportService.listStaff(), meId: req.user?.id ?? null } });
    } catch (error: any) {
      console.error('Error listing platform support staff:', error);
      fail(res, 500, 'Failed to list staff');
    }
  },

  /** GET /api/admin/support/tickets/:id */
  async getTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return fail(res, 400, 'Invalid ticket ID');

      const ticket = await platformSupportService.getTicket(ticketId);
      if (!ticket) return fail(res, 404, 'Ticket not found');
      res.json({ success: true, data: ticket });
    } catch (error: any) {
      console.error('Error getting platform ticket:', error);
      fail(res, 500, 'Failed to get ticket');
    }
  },

  /** POST /api/admin/support/tickets/:id/respond  (multipart or JSON) */
  async respond(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      const userId = req.user?.id;
      if (isNaN(ticketId)) return fail(res, 400, 'Invalid ticket ID');
      if (!userId) return fail(res, 401, 'Unauthorized');

      const validation = addResponseSchema.safeParse(req.body);
      if (!validation.success) return fail(res, 400, 'Validation failed', { details: validation.error.errors });

      const { response, associationId } = await platformSupportService.respond(ticketId, userId, validation.data);

      const { attachments, attachmentError } = await saveAttachments(
        associationId,
        ticketId,
        userId,
        response.id,
        (req.files as Express.Multer.File[] | undefined) ?? []
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'support_platform_ticket_responded',
          tableName: 'ticket_responses',
          recordId: response.id,
          newValues: { ticketId, isInternal: !!validation.data.isInternal },
        },
      });

      // A visible reply tells the admin who opened the ticket. Internal notes tell no one. Not awaited.
      if (!validation.data.isInternal) void platformSupportService.notifyOpenerOfReply(ticketId, validation.data.message);

      res.status(201).json({ success: true, data: { ...response, attachments }, ...(attachmentError ? { attachmentError } : {}) });
    } catch (error: any) {
      if (error.message === 'Ticket not found') return fail(res, 404, 'Ticket not found');
      console.error('Error responding to platform ticket:', error);
      fail(res, 500, 'Failed to add response');
    }
  },

  /** PATCH /api/admin/support/tickets/:id — assign, change status or priority */
  async updateTicket(req: Request, res: Response) {
    try {
      const ticketId = parseInt(req.params.id);
      const userId = req.user?.id;
      if (isNaN(ticketId)) return fail(res, 400, 'Invalid ticket ID');
      if (!userId) return fail(res, 401, 'Unauthorized');

      const validation = platformUpdateTicketSchema.safeParse(req.body);
      if (!validation.success) return fail(res, 400, 'Validation failed', { details: validation.error.errors });

      const { updated, associationId, statusChanged } = await platformSupportService.updateTicket(ticketId, userId, validation.data);

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'support_platform_ticket_updated', tableName: 'support_tickets', recordId: ticketId, newValues: validation.data as any },
      });

      if (statusChanged && validation.data.status) void platformSupportService.notifyOpenerOfStatus(ticketId, validation.data.status);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error.message === 'Ticket not found') return fail(res, 404, 'Ticket not found');
      if (error.message?.startsWith('Invalid status transition') || error.message?.startsWith('Tickets can only be assigned')) return fail(res, 400, error.message);
      console.error('Error updating platform ticket:', error);
      fail(res, 500, 'Failed to update ticket');
    }
  },

  /** GET /api/admin/support/attachments/:id — a short-lived link; Tier 2 tickets only */
  async getAttachment(req: Request, res: Response) {
    try {
      const attachmentId = parseInt(req.params.id);
      if (isNaN(attachmentId)) return fail(res, 400, 'Invalid attachment ID');

      const attachment = await platformSupportService.getAttachmentForAccess(attachmentId);
      if (!attachment) return fail(res, 404, 'Attachment not found');

      const url = await getPresignedUrl(attachment.filePath);
      res.json({ success: true, data: { url, filename: attachment.originalName, mimeType: attachment.mimeType } });
    } catch (error: any) {
      console.error('Error getting platform attachment:', error);
      fail(res, 500, 'Failed to get attachment');
    }
  },
};
