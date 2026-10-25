import { Request, Response } from 'express';
import { accountingPeriodsService } from './accounting-periods.service';
import { createPeriodSchema } from './accounting.validation';
import { z } from 'zod';
import { respondWithError } from './accounting-http';

// ============================================
// ACCOUNTING PERIODS CONTROLLER
// ============================================

export const accountingPeriodsController = {
  /**
   * List all accounting periods
   * GET /api/accounting/periods
   */
  async listPeriods(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const periods = await accountingPeriodsService.listPeriods(associationId);

      return res.status(200).json({ success: true, data: periods });
    } catch (error: any) {
      console.error('Error listing accounting periods:', error);
      return res.status(500).json({ success: false, message: 'Failed to list accounting periods' });
    }
  },

  /**
   * Create a new accounting period
   * POST /api/accounting/periods
   */
  async createPeriod(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createPeriodSchema.parse(req.body);
      const period = await accountingPeriodsService.createPeriod(associationId, data, req.user?.id);

      return res.status(201).json({ success: true, message: 'Accounting period created', data: period });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating accounting period:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Close an OPEN period
   * POST /api/accounting/periods/:id/close
   */
  async closePeriod(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const periodId = parseInt(req.params.id);
      const period = await accountingPeriodsService.closePeriod(associationId, periodId, userId);

      return res.status(200).json({ success: true, message: 'Accounting period closed', data: period });
    } catch (error: any) {
      console.error('Error closing accounting period:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Reopen a CLOSED period
   * POST /api/accounting/periods/:id/reopen
   */
  async reopenPeriod(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const periodId = parseInt(req.params.id);
      const period = await accountingPeriodsService.reopenPeriod(associationId, periodId, req.user?.id);

      return res.status(200).json({ success: true, message: 'Accounting period reopened', data: period });
    } catch (error: any) {
      console.error('Error reopening accounting period:', error);
      return respondWithError(res, error);
    }
  },

  /**
   * Permanently lock a CLOSED period
   * POST /api/accounting/periods/:id/lock
   */
  async lockPeriod(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const periodId = parseInt(req.params.id);
      const period = await accountingPeriodsService.lockPeriod(associationId, periodId, userId);

      return res.status(200).json({ success: true, message: 'Accounting period locked', data: period });
    } catch (error: any) {
      console.error('Error locking accounting period:', error);
      return respondWithError(res, error);
    }
  },
};
