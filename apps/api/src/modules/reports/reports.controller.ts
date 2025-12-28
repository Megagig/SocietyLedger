import { Request, Response } from 'express';
import { reportsService } from './reports.service';
import {
  financialSummaryQuerySchema,
  memberBalancesQuerySchema,
  agingAnalysisQuerySchema,
  collectionRateQuerySchema,
  categoryReportQuerySchema,
} from './reports.validation';
import { z } from 'zod';

// ============================================
// REPORTS CONTROLLER
// ============================================

export const reportsController = {
  /**
   * TASK-REP-002: Financial Summary Report API
   * GET /api/reports/financial-summary
   */
  async getFinancialSummary(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = financialSummaryQuerySchema.parse(req.query);

      const filter: any = { period: queryParams.period };
      if (queryParams.startDate) filter.startDate = new Date(queryParams.startDate);
      if (queryParams.endDate) filter.endDate = new Date(queryParams.endDate);

      const report = await reportsService.generateFinancialSummary(
        associationId,
        filter,
        queryParams.includeComparison
      );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating financial summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate financial summary' });
    }
  },

  /**
   * TASK-REP-003: Member Payment Status Report API
   * GET /api/reports/member-balances
   */
  async getMemberBalances(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = memberBalancesQuerySchema.parse(req.query);

      const result = await reportsService.generateMemberBalances(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        status: queryParams.status,
        search: queryParams.search,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating member balances:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate member balances report' });
    }
  },

  /**
   * TASK-REP-004: Outstanding Balances with Aging Analysis API
   * GET /api/reports/aging-analysis
   */
  async getAgingAnalysis(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = agingAnalysisQuerySchema.parse(req.query);

      const asOfDate = queryParams.asOfDate ? new Date(queryParams.asOfDate) : undefined;
      const report = await reportsService.generateAgingAnalysis(
        associationId,
        asOfDate,
        queryParams.includeDetails
      );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating aging analysis:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate aging analysis' });
    }
  },

  /**
   * TASK-REP-005: Collection Rate Report API
   * GET /api/reports/collection-rate
   */
  async getCollectionRate(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = collectionRateQuerySchema.parse(req.query);

      const filter: any = { period: queryParams.period };
      if (queryParams.startDate) filter.startDate = new Date(queryParams.startDate);
      if (queryParams.endDate) filter.endDate = new Date(queryParams.endDate);

      const report = await reportsService.generateCollectionRate(
        associationId,
        filter,
        queryParams.groupBy
      );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating collection rate report:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate collection rate report' });
    }
  },

  /**
   * TASK-REP-006: Category-wise Report API
   * GET /api/reports/by-category
   */
  async getCategoryReport(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = categoryReportQuerySchema.parse(req.query);

      const options: any = {
        includeTransactions: queryParams.includeTransactions,
        transactionLimit: parseInt(queryParams.transactionLimit),
      };

      if (queryParams.categoryId) options.categoryId = parseInt(queryParams.categoryId);
      if (queryParams.type) options.type = queryParams.type;
      if (queryParams.startDate) options.startDate = new Date(queryParams.startDate);
      if (queryParams.endDate) options.endDate = new Date(queryParams.endDate);

      const reports = await reportsService.generateCategoryReport(associationId, options);

      return res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error generating category report:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate category report' });
    }
  },
};
