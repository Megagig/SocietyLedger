import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { memberLedgerService } from './member-ledger.service';
import { z } from 'zod';
import { LedgerCategory } from '@prisma/client';

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  category: z.nativeEnum(LedgerCategory).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

const statementSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
});

const syncSchema = z.object({
  memberId: z.number().int().positive(),
});

export const memberLedgerController = {
  /**
   * Get current member's ledger summary (self-service)
   */
  async getMyLedgerSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member record for this user
      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const summary = await memberLedgerService.getMemberLedgerSummary(associationId, member.id);

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching ledger summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger summary' });
    }
  },

  /**
   * Get current member's ledger entries (self-service)
   */
  async getMyLedgerEntries(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const params = dateRangeSchema.parse(req.query);

      const result = await memberLedgerService.getLedgerEntries({
        associationId,
        memberId: member.id,
        ...params,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error fetching ledger entries:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger entries' });
    }
  },

  /**
   * Get current member's statement (self-service)
   */
  async getMyStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const params = statementSchema.parse(req.query);

      const statement = await memberLedgerService.generateStatement(
        associationId,
        member.id,
        params.startDate,
        params.endDate
      );

      return res.status(200).json({
        success: true,
        data: statement,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate statement' });
    }
  },

  /**
   * Get current member's balance (self-service)
   */
  async getMyBalance(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const balance = await memberLedgerService.getMemberBalance(associationId, member.id, asOfDate);

      return res.status(200).json({
        success: true,
        data: {
          memberId: member.id,
          memberNumber: member.memberId,
          balance,
          asOfDate: asOfDate || new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
  },

  // ============================================
  // ADMIN ENDPOINTS (for any member)
  // ============================================

  /**
   * Get any member's ledger summary (admin)
   */
  async getMemberLedgerSummary(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const summary = await memberLedgerService.getMemberLedgerSummary(associationId, memberId);

      return res.status(200).json({
        success: true,
        data: {
          member: {
            id: member.id,
            memberId: member.memberId,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
          },
          ...summary,
        },
      });
    } catch (error) {
      console.error('Error fetching member ledger summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger summary' });
    }
  },

  /**
   * Get any member's ledger entries (admin)
   */
  async getMemberLedgerEntries(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const params = dateRangeSchema.parse(req.query);

      const result = await memberLedgerService.getLedgerEntries({
        associationId,
        memberId,
        ...params,
      });

      return res.status(200).json({
        success: true,
        data: {
          member: {
            id: member.id,
            memberId: member.memberId,
            firstName: member.firstName,
            lastName: member.lastName,
          },
          ...result,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error fetching member ledger entries:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger entries' });
    }
  },

  /**
   * Get any member's statement (admin)
   */
  async getMemberStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const params = statementSchema.parse(req.query);

      const statement = await memberLedgerService.generateStatement(
        associationId,
        memberId,
        params.startDate,
        params.endDate
      );

      return res.status(200).json({
        success: true,
        data: statement,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating member statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate statement' });
    }
  },

  /**
   * Get any member's balance (admin)
   */
  async getMemberBalance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const balance = await memberLedgerService.getMemberBalance(associationId, memberId, asOfDate);

      return res.status(200).json({
        success: true,
        data: {
          member: {
            id: member.id,
            memberId: member.memberId,
            firstName: member.firstName,
            lastName: member.lastName,
          },
          balance,
          asOfDate: asOfDate || new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching member balance:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
  },

  /**
   * Sync existing transactions to ledger for a member (admin)
   */
  async syncMemberLedger(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const result = await memberLedgerService.syncExistingTransactions(associationId, memberId, userId);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'LEDGER_SYNC',
          tableName: 'member_financial_ledger',
          recordId: memberId,
          newValues: result,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully synced ${result.entriesCreated} ledger entries`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error syncing member ledger:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to sync ledger' 
      });
    }
  },

  /**
   * Bulk sync all members' ledgers (admin)
   */
  async bulkSyncLedgers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get all members without ledger entries
      const membersWithoutLedger = await prisma.member.findMany({
        where: {
          associationId,
          ledgerEntries: { none: {} },
        },
        select: { id: true, memberId: true, firstName: true, lastName: true },
      });

      const results = {
        total: membersWithoutLedger.length,
        synced: 0,
        failed: 0,
        errors: [] as Array<{ memberId: number; error: string }>,
      };

      for (const member of membersWithoutLedger) {
        try {
          await memberLedgerService.syncExistingTransactions(associationId, member.id, userId);
          results.synced++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ memberId: member.id, error: error.message });
        }
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'BULK_LEDGER_SYNC',
          tableName: 'member_financial_ledger',
          newValues: { total: results.total, synced: results.synced, failed: results.failed },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Synced ${results.synced} of ${results.total} members`,
        data: results,
      });
    } catch (error) {
      console.error('Error bulk syncing ledgers:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync ledgers' });
    }
  },

  /**
   * Get all members with their balances (admin report)
   */
  async getAllMemberBalances(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const search = req.query.search as string;

      // Build where clause
      const whereClause: any = { associationId };
      if (search) {
        whereClause.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { memberId: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get members with their latest ledger entry
      const [members, total] = await Promise.all([
        prisma.member.findMany({
          where: whereClause,
          select: {
            id: true,
            memberId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            ledgerEntries: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { runningBalance: true },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { lastName: 'asc' },
        }),
        prisma.member.count({ where: whereClause }),
      ]);

      const membersWithBalances = members.map(m => ({
        id: m.id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        status: m.status,
        balance: Number(m.ledgerEntries[0]?.runningBalance || 0),
      }));

      return res.status(200).json({
        success: true,
        data: {
          members: membersWithBalances,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching member balances:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch member balances' });
    }
  },
};


// Import exports service for PDF generation
import { exportsService } from '../exports/exports.service';

// Add export endpoints to the controller
export const memberLedgerExportController = {
  /**
   * Export my ledger statement as PDF (self-service)
   */
  async exportMyStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const params = statementSchema.parse(req.query);

      const result = await exportsService.exportLedgerStatementPDF(
        member.id,
        associationId,
        userId,
        { startDate: params.startDate, endDate: params.endDate }
      );

      return res.status(200).json({
        success: true,
        message: 'Statement exported successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error exporting statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to export statement' });
    }
  },

  /**
   * Export any member's ledger statement as PDF (admin)
   */
  async exportMemberStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Verify member belongs to this association
      const member = await prisma.member.findFirst({
        where: { id: memberId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      const params = statementSchema.parse(req.query);

      const result = await exportsService.exportLedgerStatementPDF(
        memberId,
        associationId,
        userId,
        { startDate: params.startDate, endDate: params.endDate }
      );

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'EXPORT_LEDGER_STATEMENT',
          tableName: 'member_financial_ledger',
          recordId: memberId,
          newValues: { startDate: params.startDate, endDate: params.endDate },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Statement exported successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error exporting member statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to export statement' });
    }
  },
};
