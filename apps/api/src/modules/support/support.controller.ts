// ============================================
// PHASE 21: SUPPORT CONTROLLER
// Ticket management endpoints
// ============================================

import { Request, Response } from 'express';
import { supportService } from './support.service';
import {
  createTicketSchema,
  updateTicketSchema,
  addResponseSchema,
  listTicketsQuerySchema,
} from './support.validation';
import { prisma } from '../../lib/prisma';

// ============================================
// SUPPORT CONTROLLER
// ============================================

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
        data: ticket,
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
      const canViewAll = req.hasPermission?.('support.view_all') || req.hasPermission?.('support.manage');

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

      const canViewAll = req.hasPermission?.('support.view_all') || req.hasPermission?.('support.manage');

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
      const isStaff = req.hasPermission?.('support.respond') || req.hasPermission?.('support.manage');

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

      // Only staff can add internal notes
      if (validation.data.isInternal && !isStaff) {
        return res.status(403).json({
          success: false,
          error: 'Only staff can add internal notes',
        });
      }

      const response = await supportService.addResponse(
        ticketId,
        userId,
        validation.data,
        isStaff
      );

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
            isStaff,
            isInternal: validation.data.isInternal,
          },
        },
      });

      res.status(201).json({
        success: true,
        data: response,
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

      const canViewAll = req.hasPermission?.('support.view_all') || req.hasPermission?.('support.manage');

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
