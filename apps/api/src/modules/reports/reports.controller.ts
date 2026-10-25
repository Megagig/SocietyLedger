import { Request, Response } from 'express';
import { z } from 'zod';
import { RuleError } from '../finance/rule-error';
import {
  generateAgingAnalysis,
  generateCategoryReport,
  generateCollectionRate,
  generateFinancialSummary,
  generateMemberBalances,
  listCharges,
  listPayments,
} from './reports-core.service';
import {
  agingAnalysisQuerySchema,
  categoryReportQuerySchema,
  chargesListQuerySchema,
  collectionRateQuerySchema,
  financialSummaryQuerySchema,
  memberBalancesQuerySchema,
  paymentsListQuerySchema,
} from './reports.validation';

// ============================================
// REPORTS CONTROLLER
// Reports are worked out live, never cached: a figure must always agree with the list of records behind it.
// ============================================

const toInt = (v: string | undefined) => (v === undefined ? undefined : parseInt(v, 10));
const toDate = (v: string | undefined) => (v ? new Date(v) : undefined);

/** A broken rule keeps its status and code; a bad query is a 400; anything else is logged and a plain 500. */
function failure(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
  if (error instanceof RuleError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

function association(req: Request, res: Response): number | null {
  const id = req.user?.associationId;
  if (!id) {
    res.status(400).json({ success: false, message: 'Association ID is required' });
    return null;
  }
  return id;
}

export const reportsController = {
  /** GET /api/reports/financial-summary — money received in the period, and how much of the charges raised in it has been paid. */
  async getFinancialSummary(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = financialSummaryQuerySchema.parse(req.query);
      const report = await generateFinancialSummary(
        associationId,
        { period: q.period, startDate: toDate(q.startDate), endDate: toDate(q.endDate) },
        q.includeComparison,
      );
      return res.status(200).json({ success: true, data: report });
    } catch (error) {
      return failure(res, error, 'Failed to generate financial summary');
    }
  },

  /** GET /api/reports/member-balances */
  async getMemberBalances(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = memberBalancesQuerySchema.parse(req.query);
      const result = await generateMemberBalances(associationId, {
        page: parseInt(q.page, 10),
        limit: Math.min(200, parseInt(q.limit, 10)),
        status: q.status,
        search: q.search,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return failure(res, error, 'Failed to generate member balances report');
    }
  },

  /** GET /api/reports/aging-analysis */
  async getAgingAnalysis(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = agingAnalysisQuerySchema.parse(req.query);
      const report = await generateAgingAnalysis(associationId, toDate(q.asOfDate), q.includeDetails);
      return res.status(200).json({ success: true, data: report });
    } catch (error) {
      return failure(res, error, 'Failed to generate aging analysis');
    }
  },

  /** GET /api/reports/collection-rate */
  async getCollectionRate(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = collectionRateQuerySchema.parse(req.query);
      const report = await generateCollectionRate(
        associationId,
        { period: q.period ?? (q.startDate && q.endDate ? 'custom' : 'this_year'), startDate: toDate(q.startDate), endDate: toDate(q.endDate) },
        q.groupBy,
      );
      return res.status(200).json({ success: true, data: report });
    } catch (error) {
      return failure(res, error, 'Failed to generate collection rate report');
    }
  },

  /** GET /api/reports/by-category */
  async getCategoryReport(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = categoryReportQuerySchema.parse(req.query);
      const reports = await generateCategoryReport(associationId, {
        categoryId: toInt(q.categoryId),
        type: q.type,
        startDate: toDate(q.startDate),
        endDate: toDate(q.endDate),
        includeTransactions: q.includeTransactions,
        transactionLimit: Math.min(100, parseInt(q.transactionLimit, 10)),
      });
      return res.status(200).json({ success: true, data: reports });
    } catch (error) {
      return failure(res, error, 'Failed to generate category report');
    }
  },

  /**
   * GET /api/reports/charges — the charges that add up to a figure on a report: raised in a period, still owing, overdue, or in an
   * aging bucket. Comes with their totals, which equal the figure that was tapped.
   */
  async listCharges(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = chargesListQuerySchema.parse(req.query);
      const data = await listCharges(
        associationId,
        {
          scope: q.scope,
          startDate: toDate(q.startDate),
          endDate: toDate(q.endDate),
          categoryId: toInt(q.categoryId),
          categoryType: q.categoryType,
          memberId: toInt(q.memberId),
          bucket: q.bucket,
          asOf: toDate(q.asOfDate),
          status: q.status,
          owingOnly: q.owingOnly,
        },
        parseInt(q.page, 10),
        Math.min(100, parseInt(q.limit, 10)),
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return failure(res, error, 'Failed to list charges');
    }
  },

  /** GET /api/reports/payments — the payments that make up "money received" in a period. */
  async listPayments(req: Request, res: Response) {
    try {
      const associationId = association(req, res);
      if (!associationId) return;
      const q = paymentsListQuerySchema.parse(req.query);
      const data = await listPayments(
        associationId,
        { startDate: toDate(q.startDate), endDate: toDate(q.endDate), categoryId: toInt(q.categoryId), categoryType: q.categoryType, memberId: toInt(q.memberId), paymentMethod: q.paymentMethod },
        parseInt(q.page, 10),
        Math.min(100, parseInt(q.limit, 10)),
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return failure(res, error, 'Failed to list payments');
    }
  },
};
