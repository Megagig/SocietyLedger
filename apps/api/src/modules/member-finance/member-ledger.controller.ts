import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { memberLedgerService, LedgerReportOptions } from './member-ledger.service';
import { z } from 'zod';

// Shared with member-finance.controller.ts — auto-links admin-created members on first access.
async function findAndAutoLinkMember(userId: number, associationId: number, userEmail?: string) {
  let member = await prisma.member.findFirst({ where: { userId, associationId } });
  if (!member && userEmail) {
    const byEmail = await prisma.member.findFirst({
      where: { email: userEmail, associationId, userId: null },
    });
    if (byEmail) {
      member = await prisma.member.update({ where: { id: byEmail.id }, data: { userId } });
    }
  }
  return member;
}

// Auto-syncs the memberFinancialLedger from Transaction data on first access.
// Idempotent — skips if entries already exist; swallows errors so the screen
// degrades to empty rather than crashing.
async function autoSyncLedgerIfEmpty(associationId: number, memberId: number, userId: number) {
  const count = await prisma.memberFinancialLedger.count({ where: { associationId, memberId } });
  if (count > 0) return;
  try {
    await memberLedgerService.syncExistingTransactions(associationId, memberId, userId);
  } catch {
    // non-critical — continue with empty ledger
  }
}

// Ledger category enum (matches Prisma schema)
const LedgerCategoryEnum = z.enum([
  'DUES', 'LEVY', 'PENALTY', 'DONATION', 'REFUND', 'WAIVER', 
  'ADJUSTMENT', 'SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAWAL', 
  'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'OTHER'
]);

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  category: LedgerCategoryEnum.optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

const statementSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
});

export const memberLedgerController = {
  async getMyLedgerSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }
      // First access: populate ledger from existing transactions so it's never empty.
      await autoSyncLedgerIfEmpty(associationId, member.id, userId);
      const summary = await memberLedgerService.getMemberLedgerSummary(associationId, member.id);
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      console.error('Error fetching ledger summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger summary' });
    }
  },

  async getMyLedgerEntries(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }
      await autoSyncLedgerIfEmpty(associationId, member.id, userId);
      const params = dateRangeSchema.parse(req.query);
      const options: LedgerReportOptions = {
        associationId, memberId: member.id,
        startDate: params.startDate, endDate: params.endDate,
        category: params.category as any, page: params.page, limit: params.limit,
      };
      const result = await memberLedgerService.getLedgerEntries(options);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error fetching ledger entries:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger entries' });
    }
  },

  async getMyStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }
      const params = statementSchema.parse(req.query);
      const statement = await memberLedgerService.generateStatement(associationId, member.id, params.startDate, params.endDate);
      return res.status(200).json({ success: true, data: statement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate statement' });
    }
  },

  async getMyBalance(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const balance = await memberLedgerService.getMemberBalance(associationId, member.id, asOfDate);
      return res.status(200).json({
        success: true,
        data: { memberId: member.id, memberNumber: member.memberId, balance, asOfDate: asOfDate || new Date() },
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
  },

  // ADMIN ENDPOINTS
  async getMemberLedgerSummary(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const summary = await memberLedgerService.getMemberLedgerSummary(associationId, memberId);
      return res.status(200).json({
        success: true,
        data: {
          member: { id: member.id, memberId: member.memberId, firstName: member.firstName, lastName: member.lastName, email: member.email },
          ...summary,
        },
      });
    } catch (error) {
      console.error('Error fetching member ledger summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch ledger summary' });
    }
  },

  async getMemberLedgerEntries(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const params = dateRangeSchema.parse(req.query);
      const options: LedgerReportOptions = {
        associationId, memberId,
        startDate: params.startDate, endDate: params.endDate,
        category: params.category as any, page: params.page, limit: params.limit,
      };
      const result = await memberLedgerService.getLedgerEntries(options);
      return res.status(200).json({
        success: true,
        data: {
          member: { id: member.id, memberId: member.memberId, firstName: member.firstName, lastName: member.lastName },
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

  async getMemberStatement(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const params = statementSchema.parse(req.query);
      const statement = await memberLedgerService.generateStatement(associationId, memberId, params.startDate, params.endDate);
      return res.status(200).json({ success: true, data: statement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating member statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate statement' });
    }
  },

  async getMemberBalance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const balance = await memberLedgerService.getMemberBalance(associationId, memberId, asOfDate);
      return res.status(200).json({
        success: true,
        data: {
          member: { id: member.id, memberId: member.memberId, firstName: member.firstName, lastName: member.lastName },
          balance, asOfDate: asOfDate || new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching member balance:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
  },

  async syncMemberLedger(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      const force = req.query.force === 'true';
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const result = await memberLedgerService.syncExistingTransactions(associationId, memberId, userId, force);
      await prisma.auditLog.create({
        data: { associationId, userId, action: force ? 'LEDGER_RESYNC' : 'LEDGER_SYNC', tableName: 'member_financial_ledger', recordId: memberId, newValues: result },
      });
      return res.status(200).json({ success: true, message: `Successfully synced ${result.entriesCreated} ledger entries`, data: result });
    } catch (error: any) {
      console.error('Error syncing member ledger:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to sync ledger' });
    }
  },

  /**
   * Force re-sync all ledgers for an association (clears and rebuilds)
   */
  async forceResyncAllLedgers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      
      // Clear all existing ledger entries for the association
      const cleared = await memberLedgerService.clearAssociationLedgers(associationId);
      
      // Get all members and sync their ledgers
      const allMembers = await prisma.member.findMany({ 
        where: { associationId }, 
        select: { id: true, memberId: true, firstName: true, lastName: true } 
      });
      
      const results = { 
        cleared, 
        total: allMembers.length, 
        synced: 0, 
        failed: 0, 
        errors: [] as Array<{ memberId: number; error: string }> 
      };
      
      for (const member of allMembers) {
        try {
          await memberLedgerService.syncExistingTransactions(associationId, member.id, userId, false);
          results.synced++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ memberId: member.id, error: error.message });
        }
      }
      
      await prisma.auditLog.create({
        data: { 
          associationId, 
          userId, 
          action: 'FORCE_RESYNC_ALL_LEDGERS', 
          tableName: 'member_financial_ledger', 
          newValues: { cleared, total: results.total, synced: results.synced, failed: results.failed } 
        },
      });
      
      return res.status(200).json({ 
        success: true, 
        message: `Cleared ${cleared} entries, re-synced ${results.synced} of ${results.total} members`, 
        data: results 
      });
    } catch (error) {
      console.error('Error force re-syncing ledgers:', error);
      return res.status(500).json({ success: false, message: 'Failed to force re-sync ledgers' });
    }
  },

  async bulkSyncLedgers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const allMembers = await prisma.member.findMany({ where: { associationId }, select: { id: true, memberId: true, firstName: true, lastName: true } });
      
      // Check which members have ledger entries using raw query
      const membersWithLedgerResult = await prisma.$queryRaw<Array<{ member_id: number }>>`
        SELECT DISTINCT member_id FROM member_financial_ledger WHERE association_id = ${associationId}
      `;
      const memberIdsWithLedger = new Set(membersWithLedgerResult.map((m: { member_id: number }) => m.member_id));
      const membersWithoutLedger = allMembers.filter(m => !memberIdsWithLedger.has(m.id));
      const results = { total: membersWithoutLedger.length, synced: 0, failed: 0, errors: [] as Array<{ memberId: number; error: string }> };
      for (const member of membersWithoutLedger) {
        try {
          await memberLedgerService.syncExistingTransactions(associationId, member.id, userId);
          results.synced++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ memberId: member.id, error: error.message });
        }
      }
      await prisma.auditLog.create({
        data: { associationId, userId, action: 'BULK_LEDGER_SYNC', tableName: 'member_financial_ledger', newValues: { total: results.total, synced: results.synced, failed: results.failed } },
      });
      return res.status(200).json({ success: true, message: `Synced ${results.synced} of ${results.total} members`, data: results });
    } catch (error) {
      console.error('Error bulk syncing ledgers:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync ledgers' });
    }
  },

  async getAllMemberBalances(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const search = req.query.search as string;
      const whereClause: any = { associationId };
      if (search) {
        whereClause.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { memberId: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      const [members, total] = await Promise.all([
        prisma.member.findMany({ where: whereClause, select: { id: true, memberId: true, firstName: true, lastName: true, email: true, status: true }, skip: (page - 1) * limit, take: limit, orderBy: { lastName: 'asc' } }),
        prisma.member.count({ where: whereClause }),
      ]);
      // One query for the latest running balance of every member on the page (it used to be one query per member).
      const latest = members.length === 0 ? [] : await prisma.memberFinancialLedger.findMany({
        where: { associationId, memberId: { in: members.map((m) => m.id) } },
        orderBy: [{ memberId: 'asc' }, { createdAt: 'desc' }],
        distinct: ['memberId'],
        select: { memberId: true, runningBalance: true },
      });
      const balanceByMember = new Map(latest.map((row) => [row.memberId, Number(row.runningBalance)]));
      const membersWithBalances = members.map((m) => ({ ...m, balance: balanceByMember.get(m.id) ?? 0 }));
      return res.status(200).json({ success: true, data: { members: membersWithBalances, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
      console.error('Error fetching member balances:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch member balances' });
    }
  },
};


// Export controller for PDF exports
export const memberLedgerExportController = {
  async exportMyStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { userId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }
      const params = statementSchema.parse(req.query);
      const { exportsService } = await import('../exports/exports.service');
      const result = await exportsService.exportLedgerStatementPDF(member.id, associationId, userId, { startDate: params.startDate, endDate: params.endDate });
      return res.status(200).json({ success: true, message: 'Statement exported successfully', data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error exporting statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to export statement' });
    }
  },

  async exportMemberStatement(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const memberId = parseInt(req.params.memberId, 10);
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }
      const member = await prisma.member.findFirst({ where: { id: memberId, associationId } });
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      const params = statementSchema.parse(req.query);
      const { exportsService } = await import('../exports/exports.service');
      const result = await exportsService.exportLedgerStatementPDF(memberId, associationId, userId, { startDate: params.startDate, endDate: params.endDate });
      await prisma.auditLog.create({
        data: { associationId, userId, action: 'EXPORT_LEDGER_STATEMENT', tableName: 'member_financial_ledger', recordId: memberId, newValues: { startDate: params.startDate, endDate: params.endDate } },
      });
      return res.status(200).json({ success: true, message: 'Statement exported successfully', data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error exporting member statement:', error);
      return res.status(500).json({ success: false, message: 'Failed to export statement' });
    }
  },
};
