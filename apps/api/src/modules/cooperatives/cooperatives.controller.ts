import { Request, Response } from 'express';
import { cooperativesService } from './cooperatives.service';
import {
  createSavingsAccountSchema,
  updateSavingsAccountSchema,
  savingsAccountQuerySchema,
  createSavingsTransactionSchema,
  savingsTransactionQuerySchema,
  createLoanProductSchema,
  updateLoanProductSchema,
  loanProductQuerySchema,
  createLoanApplicationSchema,
  updateLoanApplicationSchema,
  loanApplicationQuerySchema,
  reviewLoanApplicationSchema,
  respondToGuarantorRequestSchema,
  createLoanRepaymentSchema,
  loanRepaymentQuerySchema,
  loanQuerySchema,
  disburseLoanSchema,
} from './cooperatives.validation';
import { z } from 'zod';

// ============================================
// COOPERATIVES CONTROLLER - Phase 8.5
// Enterprise Feature - Thrift & Savings, Loans, Guarantors
// ============================================

export const cooperativesController = {
  // ==========================================
  // SAVINGS ACCOUNT ENDPOINTS
  // ==========================================

  /**
   * Create a savings account
   * POST /api/cooperatives/savings-accounts
   */
  async createSavingsAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createSavingsAccountSchema.parse(req.body);
      const account = await cooperativesService.createSavingsAccount(associationId, data);

      return res.status(201).json({
        success: true,
        message: 'Savings account created successfully',
        data: account,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating savings account:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get savings accounts
   * GET /api/cooperatives/savings-accounts
   */
  async getSavingsAccounts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = savingsAccountQuerySchema.parse(req.query);

      const result = await cooperativesService.getSavingsAccounts(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        memberId: queryParams.memberId ? parseInt(queryParams.memberId) : undefined,
        accountType: queryParams.accountType,
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
      console.error('Error getting savings accounts:', error);
      return res.status(500).json({ success: false, message: 'Failed to get savings accounts' });
    }
  },

  /**
   * Get a single savings account
   * GET /api/cooperatives/savings-accounts/:id
   */
  async getSavingsAccount(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const accountId = parseInt(req.params.id);
      const account = await cooperativesService.getSavingsAccount(associationId, accountId);

      if (!account) {
        return res.status(404).json({ success: false, message: 'Savings account not found' });
      }

      return res.status(200).json({
        success: true,
        data: account,
      });
    } catch (error) {
      console.error('Error getting savings account:', error);
      return res.status(500).json({ success: false, message: 'Failed to get savings account' });
    }
  },

  /**
   * Process a savings transaction
   * POST /api/cooperatives/savings-transactions
   */
  async processSavingsTransaction(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const data = createSavingsTransactionSchema.parse(req.body);
      const transaction = await cooperativesService.processSavingsTransaction(
        associationId,
        userId,
        data
      );

      return res.status(201).json({
        success: true,
        message: `${data.type} processed successfully`,
        data: transaction,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error processing savings transaction:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get savings transactions
   * GET /api/cooperatives/savings-transactions
   */
  async getSavingsTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = savingsTransactionQuerySchema.parse(req.query);

      const result = await cooperativesService.getSavingsTransactions(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        savingsAccountId: queryParams.savingsAccountId
          ? parseInt(queryParams.savingsAccountId)
          : undefined,
        type: queryParams.type,
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting savings transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to get savings transactions' });
    }
  },

  // ==========================================
  // LOAN PRODUCT ENDPOINTS
  // ==========================================

  /**
   * Create a loan product
   * POST /api/cooperatives/loan-products
   */
  async createLoanProduct(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const data = createLoanProductSchema.parse(req.body);
      const product = await cooperativesService.createLoanProduct(associationId, data);

      return res.status(201).json({
        success: true,
        message: 'Loan product created successfully',
        data: product,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating loan product:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get loan products
   * GET /api/cooperatives/loan-products
   */
  async getLoanProducts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = loanProductQuerySchema.parse(req.query);

      const result = await cooperativesService.getLoanProducts(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        isActive: queryParams.isActive,
        search: queryParams.search,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting loan products:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loan products' });
    }
  },

  /**
   * Update a loan product
   * PUT /api/cooperatives/loan-products/:id
   */
  async updateLoanProduct(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const productId = parseInt(req.params.id);
      const data = updateLoanProductSchema.parse(req.body);
      const product = await cooperativesService.updateLoanProduct(associationId, productId, data);

      return res.status(200).json({
        success: true,
        message: 'Loan product updated successfully',
        data: product,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating loan product:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },


  // ==========================================
  // LOAN APPLICATION ENDPOINTS
  // ==========================================

  /**
   * Create a loan application
   * POST /api/cooperatives/loan-applications
   */
  async createLoanApplication(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member ID from user
      const member = await require('../../lib/prisma').prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(400).json({ success: false, message: 'Member profile not found' });
      }

      const data = createLoanApplicationSchema.parse(req.body);
      const application = await cooperativesService.createLoanApplication(
        associationId,
        member.id,
        data
      );

      return res.status(201).json({
        success: true,
        message: 'Loan application submitted successfully',
        data: application,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating loan application:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get loan applications
   * GET /api/cooperatives/loan-applications
   */
  async getLoanApplications(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = loanApplicationQuerySchema.parse(req.query);

      const result = await cooperativesService.getLoanApplications(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        memberId: queryParams.memberId ? parseInt(queryParams.memberId) : undefined,
        status: queryParams.status,
        loanProductId: queryParams.loanProductId ? parseInt(queryParams.loanProductId) : undefined,
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
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
      console.error('Error getting loan applications:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loan applications' });
    }
  },

  /**
   * Get a single loan application
   * GET /api/cooperatives/loan-applications/:id
   */
  async getLoanApplication(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const applicationId = parseInt(req.params.id);
      const application = await cooperativesService.getLoanApplication(associationId, applicationId);

      if (!application) {
        return res.status(404).json({ success: false, message: 'Loan application not found' });
      }

      return res.status(200).json({
        success: true,
        data: application,
      });
    } catch (error) {
      console.error('Error getting loan application:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loan application' });
    }
  },

  /**
   * Review a loan application
   * POST /api/cooperatives/loan-applications/:id/review
   */
  async reviewLoanApplication(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const applicationId = parseInt(req.params.id);
      const { action, comments, rejectionReason } = reviewLoanApplicationSchema.parse(req.body);

      const application = await cooperativesService.reviewLoanApplication(
        associationId,
        applicationId,
        userId,
        action,
        comments,
        rejectionReason
      );

      return res.status(200).json({
        success: true,
        message: `Loan application ${action}d successfully`,
        data: application,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error reviewing loan application:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Disburse an approved loan
   * POST /api/cooperatives/loan-applications/:id/disburse
   */
  async disburseLoan(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const applicationId = parseInt(req.params.id);
      const { disbursementMethod, bankAccountId, savingsAccountId, reference, notes } =
        disburseLoanSchema.parse(req.body);

      const loan = await cooperativesService.disburseLoan(
        associationId,
        applicationId,
        userId,
        disbursementMethod,
        { bankAccountId, savingsAccountId, reference, notes }
      );

      return res.status(201).json({
        success: true,
        message: 'Loan disbursed successfully',
        data: loan,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error disbursing loan:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // ==========================================
  // GUARANTOR ENDPOINTS
  // ==========================================

  /**
   * Respond to a guarantor request
   * POST /api/cooperatives/guarantor-requests/:id/respond
   */
  async respondToGuarantorRequest(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member ID from user
      const member = await require('../../lib/prisma').prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(400).json({ success: false, message: 'Member profile not found' });
      }

      const guarantorId = parseInt(req.params.id);
      const { action, declineReason } = respondToGuarantorRequestSchema.parse(req.body);

      const guarantor = await cooperativesService.respondToGuarantorRequest(
        associationId,
        guarantorId,
        member.id,
        action,
        declineReason
      );

      return res.status(200).json({
        success: true,
        message: `Guarantor request ${action}ed successfully`,
        data: guarantor,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error responding to guarantor request:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get pending guarantor requests for current user
   * GET /api/cooperatives/guarantor-requests/pending
   */
  async getPendingGuarantorRequests(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member ID from user
      const member = await require('../../lib/prisma').prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(200).json({ success: true, data: [] });
      }

      const requests = await cooperativesService.getPendingGuarantorRequests(
        associationId,
        member.id
      );

      return res.status(200).json({
        success: true,
        data: requests,
      });
    } catch (error) {
      console.error('Error getting pending guarantor requests:', error);
      return res.status(500).json({ success: false, message: 'Failed to get guarantor requests' });
    }
  },

  // ==========================================
  // LOAN ENDPOINTS
  // ==========================================

  /**
   * Get active loans
   * GET /api/cooperatives/loans
   */
  async getLoans(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = loanQuerySchema.parse(req.query);

      const result = await cooperativesService.getLoans(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        memberId: queryParams.memberId ? parseInt(queryParams.memberId) : undefined,
        status: queryParams.status,
        loanProductId: queryParams.loanProductId ? parseInt(queryParams.loanProductId) : undefined,
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
      console.error('Error getting loans:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loans' });
    }
  },

  /**
   * Get a single loan
   * GET /api/cooperatives/loans/:id
   */
  async getLoan(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const loanId = parseInt(req.params.id);
      const loan = await cooperativesService.getLoan(associationId, loanId);

      if (!loan) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      return res.status(200).json({
        success: true,
        data: loan,
      });
    } catch (error) {
      console.error('Error getting loan:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loan' });
    }
  },

  /**
   * Process a loan repayment
   * POST /api/cooperatives/loan-repayments
   */
  async processLoanRepayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const data = createLoanRepaymentSchema.parse(req.body);
      const repayment = await cooperativesService.processLoanRepayment(associationId, userId, data);

      return res.status(201).json({
        success: true,
        message: 'Loan repayment processed successfully',
        data: repayment,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error processing loan repayment:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Get loan repayments
   * GET /api/cooperatives/loan-repayments
   */
  async getLoanRepayments(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = loanRepaymentQuerySchema.parse(req.query);

      const result = await cooperativesService.getLoanRepayments(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        loanId: queryParams.loanId ? parseInt(queryParams.loanId) : undefined,
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting loan repayments:', error);
      return res.status(500).json({ success: false, message: 'Failed to get loan repayments' });
    }
  },

  // ==========================================
  // DASHBOARD & PROFILE ENDPOINTS
  // ==========================================

  /**
   * Get cooperative dashboard
   * GET /api/cooperatives/dashboard
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const dashboard = await cooperativesService.getDashboard(associationId);

      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error getting cooperative dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to get dashboard' });
    }
  },

  /**
   * Get member's cooperative profile
   * GET /api/cooperatives/members/:id/profile
   */
  async getMemberCooperativeProfile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const memberId = parseInt(req.params.id);
      const profile = await cooperativesService.getMemberCooperativeProfile(associationId, memberId);

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('Error getting member cooperative profile:', error);
      return res.status(500).json({ success: false, message: 'Failed to get member profile' });
    }
  },

  /**
   * Get current user's cooperative profile
   * GET /api/cooperatives/my-profile
   */
  async getMyCooperativeProfile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member ID from user
      const member = await require('../../lib/prisma').prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const profile = await cooperativesService.getMemberCooperativeProfile(associationId, member.id);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('Error getting my cooperative profile:', error);
      return res.status(500).json({ success: false, message: 'Failed to get profile' });
    }
  },
};
