import { Request, Response } from 'express';
import { exportsService } from './exports.service';
import {
  exportFinancialSummarySchema,
  exportMemberStatementSchema,
  exportAllMembersSchema,
  getExportHistorySchema,
} from './exports.validation';
import * as fs from 'fs';

// ============================================
// EXPORT CONTROLLER
// ============================================

export const exportsController = {
  /**
   * TASK-EXP-004: Export Financial Summary as PDF
   * POST /api/exports/financial-pdf
   */
  async exportFinancialPDF(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const userId = req.user!.id;

      const validation = exportFinancialSummarySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { period, startDate, endDate, includeComparison } = validation.data;

      const filters: any = {};
      if (period) filters.period = period;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const result = await exportsService.exportFinancialSummaryPDF(
        associationId,
        userId,
        filters
      );

      res.json({
        success: true,
        message: 'Financial summary PDF generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Export financial PDF error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate PDF export',
      });
    }
  },

  /**
   * TASK-EXP-005: Export Financial Summary as Excel
   * POST /api/exports/financial-excel
   */
  async exportFinancialExcel(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const userId = req.user!.id;

      const validation = exportFinancialSummarySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { period, startDate, endDate } = validation.data;

      const filters: any = {};
      if (period) filters.period = period;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const result = await exportsService.exportFinancialSummaryExcel(
        associationId,
        userId,
        filters
      );

      res.json({
        success: true,
        message: 'Financial summary Excel generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Export financial Excel error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate Excel export',
      });
    }
  },

  /**
   * TASK-EXP-006: Export Member Statement as PDF
   * POST /api/exports/member-statement/:memberId
   */
  async exportMemberStatementPDF(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const userId = req.user!.id;
      const memberId = parseInt(req.params.memberId);

      if (isNaN(memberId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid member ID',
        });
      }

      const validation = exportMemberStatementSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { startDate, endDate } = validation.data;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const result = await exportsService.exportMemberStatementPDF(
        memberId,
        associationId,
        userId,
        filters
      );

      res.json({
        success: true,
        message: 'Member statement PDF generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Export member statement error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate member statement',
      });
    }
  },

  /**
   * TASK-EXP-007: Export All Members as Excel
   * POST /api/exports/members-excel
   */
  async exportAllMembersExcel(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const userId = req.user!.id;

      const validation = exportAllMembersSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { status } = validation.data;

      const filters: any = {};
      if (status) filters.status = status;

      const result = await exportsService.exportAllMembersExcel(
        associationId,
        userId,
        filters
      );

      res.json({
        success: true,
        message: 'Members Excel generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Export members Excel error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate members export',
      });
    }
  },

  /**
   * TASK-EXP-008: Export Custom Members as Excel
   * POST /api/exports/custom-members-excel
   */
  async exportCustomMembersExcel(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const userId = req.user!.id;

      const { fields, status } = req.body;

      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Fields array is required and must not be empty',
        });
      }

      const filters: any = { fields };
      if (status) filters.status = status;

      const result = await exportsService.exportCustomMembersExcel(
        associationId,
        userId,
        filters
      );

      res.json({
        success: true,
        message: 'Custom members Excel generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Export custom members Excel error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate custom members export',
      });
    }
  },

  /**
   * TASK-EXP-008: Get Export History
   * GET /api/exports/history
   */
  async getExportHistory(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;

      const validation = getExportHistorySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors,
        });
      }

      const { page, limit, type, format } = validation.data;

      const options: any = {};
      if (page) options.page = parseInt(page);
      if (limit) options.limit = parseInt(limit);
      if (type) options.type = type;
      if (format) options.format = format;

      const result = await exportsService.getExportHistory(associationId, options);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get export history error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get export history',
      });
    }
  },

  /**
   * TASK-EXP-010: Download Export File
   * GET /api/exports/download/:id
   */
  async downloadExport(req: Request, res: Response) {
    try {
      const associationId = req.user!.associationId!;
      const exportId = parseInt(req.params.id);

      if (isNaN(exportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid export ID',
        });
      }

      const exportRecord = await exportsService.getExportById(exportId, associationId);

      // Set headers for file download
      const contentType =
        exportRecord.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportRecord.filename}"`);
      res.setHeader('Content-Length', exportRecord.fileSize);

      // Stream file to response
      const fileStream = fs.createReadStream(exportRecord.filepath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download file',
          });
        }
      });
    } catch (error: any) {
      console.error('Download export error:', error);
      res.status(error.message.includes('not found') || error.message.includes('expired') ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to download export',
      });
    }
  },
};
