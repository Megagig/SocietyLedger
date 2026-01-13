import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExportOptions,
  ExportResult,
  AssociationBranding,
  MemberStatementData,
  LedgerStatementData,
} from './exports.types';
import { pdfService } from './pdf.service';
import { excelService } from './excel.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';

// ============================================
// EXPORT SERVICE
// ============================================

export const exportsService = {
  /**
   * Get association branding information
   */
  async getAssociationBranding(associationId: number): Promise<AssociationBranding> {
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: {
        name: true,
        logo: true,
        primaryColor: true,
      },
    });

    if (!association) {
      throw new Error('Association not found');
    }

    return {
      name: association.name,
      logo: association.logo,
      primaryColor: association.primaryColor,
      secondaryColor: null,
      address: null,
      phone: null,
      email: null,
      website: null,
    };
  },

  /**
   * Create export directory if it doesn't exist
   */
  ensureExportDirectory(): string {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  },

  /**
   * Generate unique filename
   */
  generateFilename(type: string, format: string, associationId: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}_${associationId}_${timestamp}.${format}`;
  },

  /**
   * Save export record to database
   */
  async saveExportRecord(
    associationId: number,
    userId: number,
    type: string,
    format: string,
    filename: string,
    filepath: string,
    fileSize: number
  ): Promise<ExportResult> {
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const exportRecord = await prisma.exportHistory.create({
      data: {
        associationId,
        userId,
        type,
        format,
        filename,
        filepath,
        fileSize,
        expiresAt,
      },
    });

    return {
      id: exportRecord.id,
      filename: exportRecord.filename,
      filepath: exportRecord.filepath,
      format: format as 'pdf' | 'excel',
      type: type as any,
      fileSize: exportRecord.fileSize,
      downloadUrl: `/api/exports/download/${exportRecord.id}`,
      expiresAt: exportRecord.expiresAt,
    };
  },

  /**
   * Get export history for an association
   */
  async getExportHistory(
    associationId: number,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      format?: string;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = { associationId };
    if (options.type) whereClause.type = options.type;
    if (options.format) whereClause.format = options.format;

    const [exports, totalCount] = await Promise.all([
      prisma.exportHistory.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              member: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.exportHistory.count({ where: whereClause }),
    ]);

    return {
      exports: exports.map(exp => ({
        id: exp.id,
        type: exp.type,
        format: exp.format,
        filename: exp.filename,
        fileSize: exp.fileSize,
        downloadUrl: `/api/exports/download/${exp.id}`,
        createdAt: exp.createdAt,
        expiresAt: exp.expiresAt,
        createdBy: {
          id: exp.user.id,
          name: exp.user.member 
            ? `${exp.user.member.firstName} ${exp.user.member.lastName}`
            : exp.user.email,
          email: exp.user.email,
        },
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + exports.length < totalCount,
      },
    };
  },

  /**
   * Get export by ID
   */
  async getExportById(exportId: number, associationId: number) {
    const exportRecord = await prisma.exportHistory.findFirst({
      where: {
        id: exportId,
        associationId,
      },
    });

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    // Check if expired
    if (new Date() > exportRecord.expiresAt) {
      throw new Error('Export has expired');
    }

    // Check if file exists
    if (!fs.existsSync(exportRecord.filepath)) {
      throw new Error('Export file not found');
    }

    return exportRecord;
  },

  /**
   * Delete expired exports (cleanup job)
   */
  async deleteExpiredExports(): Promise<number> {
    const expiredExports = await prisma.exportHistory.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    let deletedCount = 0;

    for (const exp of expiredExports) {
      try {
        // Delete file
        if (fs.existsSync(exp.filepath)) {
          fs.unlinkSync(exp.filepath);
        }

        // Delete record
        await prisma.exportHistory.delete({
          where: { id: exp.id },
        });

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete export ${exp.id}:`, error);
      }
    }

    return deletedCount;
  },

  /**
   * Get member statement data
   */
  async getMemberStatementData(
    memberId: number,
    associationId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<MemberStatementData> {
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        associationId,
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    const whereClause: any = {
      memberId,
      associationId,
    };

    if (options.startDate && options.endDate) {
      whereClause.createdAt = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            name: true,
            type: true,
          },
        },
        payments: {
          select: {
            id: true,
            amountPaid: true,
            paymentMethod: true,
            paymentDate: true,
          },
          orderBy: { paymentDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalDues = new Decimal(0);
    let totalPaid = new Decimal(0);
    let lastPaymentDate: Date | null = null;

    const transactionData = transactions.map(txn => {
      const paidAmount = txn.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const balance = new Decimal(txn.amount).minus(paidAmount);

      totalDues = totalDues.plus(txn.amount);
      totalPaid = totalPaid.plus(paidAmount);

      // Track last payment date
      txn.payments.forEach(p => {
        if (!lastPaymentDate || p.paymentDate > lastPaymentDate) {
          lastPaymentDate = p.paymentDate;
        }
      });

      return {
        id: txn.id,
        referenceNumber: txn.referenceNumber || '',
        categoryName: txn.category.name,
        categoryType: txn.category.type,
        amount: txn.amount,
        paidAmount,
        balance,
        status: txn.status,
        dueDate: txn.dueDate,
        createdAt: txn.createdAt,
        payments: txn.payments.map(p => ({
          id: p.id,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod || 'N/A',
          paymentDate: p.paymentDate,
          referenceNumber: null,
        })),
      };
    });

    return {
      member: {
        id: member.id,
        memberNumber: member.memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        address: member.address,
      },
      summary: {
        totalDues,
        totalPaid,
        balance: totalDues.minus(totalPaid),
        lastPaymentDate,
      },
      transactions: transactionData,
      statementDate: new Date(),
      periodStart: options.startDate,
      periodEnd: options.endDate,
    };
  },

  /**
   * Export financial summary as PDF
   */
  async exportFinancialSummaryPDF(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('financial_summary', 'pdf', associationId);
    const filepath = path.join(exportDir, filename);

    await pdfService.generateFinancialSummaryPDF(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'financial_summary',
      'pdf',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export financial summary as Excel
   */
  async exportFinancialSummaryExcel(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('financial_summary', 'xlsx', associationId);
    const filepath = path.join(exportDir, filename);

    await excelService.generateFinancialSummaryExcel(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'financial_summary',
      'excel',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export member statement as PDF
   */
  async exportMemberStatementPDF(
    memberId: number,
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const statementData = await this.getMemberStatementData(memberId, associationId, filters);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename(`member_statement_${memberId}`, 'pdf', associationId);
    const filepath = path.join(exportDir, filename);

    await pdfService.generateMemberStatementPDF(statementData, branding, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'member_statement',
      'pdf',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export all members with balances as Excel
   */
  async exportAllMembersExcel(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('all_members', 'xlsx', associationId);
    const filepath = path.join(exportDir, filename);

    await excelService.generateAllMembersExcel(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'all_members',
      'excel',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export custom members with selected fields as Excel
   */
  async exportCustomMembersExcel(
    associationId: number,
    userId: number,
    filters: any
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename('custom_members', 'xlsx', associationId);
    const filepath = path.join(exportDir, filename);

    await excelService.generateCustomMembersExcel(associationId, branding, filters, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'custom_members',
      'excel',
      filename,
      filepath,
      stats.size
    );
  },

  /**
   * Export member ledger statement as PDF
   * Complete financial history with opening/closing balance
   */
  async exportLedgerStatementPDF(
    memberId: number,
    associationId: number,
    userId: number,
    filters: { startDate: Date; endDate: Date }
  ): Promise<ExportResult> {
    const branding = await this.getAssociationBranding(associationId);
    
    // Generate ledger statement data
    const statementData = await memberLedgerService.generateStatement(
      associationId,
      memberId,
      filters.startDate,
      filters.endDate
    );

    // Convert to LedgerStatementData format
    const ledgerData: LedgerStatementData = {
      member: statementData.member,
      period: statementData.period,
      openingBalance: statementData.openingBalance,
      entries: statementData.entries,
      totals: statementData.totals,
      closingBalance: statementData.closingBalance,
    };

    const exportDir = this.ensureExportDirectory();
    const filename = this.generateFilename(`ledger_statement_${memberId}`, 'pdf', associationId);
    const filepath = path.join(exportDir, filename);

    await pdfService.generateLedgerStatementPDF(ledgerData, branding, filepath);

    const stats = fs.statSync(filepath);
    return this.saveExportRecord(
      associationId,
      userId,
      'ledger_statement',
      'pdf',
      filename,
      filepath,
      stats.size
    );
  },
};
